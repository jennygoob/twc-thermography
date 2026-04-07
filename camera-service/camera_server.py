"""
TWC Thermography — Camera Service
Flask server that interfaces with the FLIR A300 camera via GigE Vision.

Endpoints:
  GET  /status   — Camera connection status
  GET  /stream   — MJPEG live stream
  POST /capture  — Capture single frame (radiometric + display)
  GET  /settings — Current camera settings
  PUT  /settings — Update camera settings
"""

import os
import sys
import time
import json
import threading
import datetime
from io import BytesIO

from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import cv2

from config import (
    CAMERA_IP, HOST, PORT, CAPTURE_DIR,
    DEFAULT_EMISSIVITY, TEMP_RANGE_MIN, TEMP_RANGE_MAX,
    DEFAULT_PALETTE, OUTPUT_WIDTH, OUTPUT_HEIGHT,
)
from thermal_processor import (
    temperature_to_colormap, colorized_to_jpeg, generate_thumbnail,
    save_radiometric_tiff, add_temperature_scale, extract_region_stats,
    generate_simulated_thermal,
)


app = Flask(__name__)
CORS(app, origins="*")

# ============================================================
# Camera state
# ============================================================

camera_lock = threading.Lock()
camera_connected = False
camera_error = None
current_settings = {
    "emissivity": DEFAULT_EMISSIVITY,
    "palette": DEFAULT_PALETTE,
    "temp_range_min": TEMP_RANGE_MIN,
    "temp_range_max": TEMP_RANGE_MAX,
}

# Spinnaker SDK camera handle (None if not available)
spinnaker_cam = None
use_simulation = True  # Falls back to simulated thermal data


def init_camera():
    """Try to connect to FLIR A300 via Spinnaker SDK."""
    global camera_connected, camera_error, spinnaker_cam, use_simulation

    try:
        import PySpin
        system = PySpin.System.GetInstance()
        cam_list = system.GetCameras()

        if cam_list.GetSize() == 0:
            camera_error = "No cameras found on network"
            camera_connected = False
            use_simulation = True
            cam_list.Clear()
            return

        spinnaker_cam = cam_list[0]
        spinnaker_cam.Init()
        spinnaker_cam.AcquisitionMode.SetValue(PySpin.AcquisitionMode_Continuous)
        spinnaker_cam.BeginAcquisition()

        camera_connected = True
        camera_error = None
        use_simulation = False
        print(f"[Camera] Connected to FLIR camera: {spinnaker_cam.DeviceModelName.GetValue()}")

    except ImportError:
        camera_error = "Spinnaker SDK not installed — using simulation mode"
        camera_connected = False
        use_simulation = True
        print("[Camera] PySpin not available — running in simulation mode")

    except Exception as e:
        camera_error = str(e)
        camera_connected = False
        use_simulation = True
        print(f"[Camera] Connection failed: {e} — running in simulation mode")


def grab_frame() -> np.ndarray:
    """
    Grab a single thermal frame as a temperature array (Celsius).
    Returns shape (H, W) float64 array.
    """
    if use_simulation:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    try:
        import PySpin
        with camera_lock:
            image_result = spinnaker_cam.GetNextImage(1000)
            if image_result.IsIncomplete():
                raise RuntimeError("Incomplete image")

            # Get raw 16-bit data
            raw = image_result.GetNDArray()
            image_result.Release()

            # Convert to temperature (camera-specific calibration)
            from thermal_processor import radiometric_to_temperature
            return radiometric_to_temperature(raw)

    except Exception as e:
        print(f"[Camera] Frame grab error: {e}")
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)


# ============================================================
# Routes
# ============================================================

@app.route('/status', methods=['GET'])
def status():
    """Camera connection status and current settings."""
    return jsonify({
        "connected": camera_connected or use_simulation,
        "simulation_mode": use_simulation,
        "camera_model": "FLIR A300" if camera_connected else "Simulated",
        "serial_number": None,
        "firmware_version": None,
        "sensor_temperature_celsius": None,
        "current_palette": current_settings["palette"],
        "emissivity": current_settings["emissivity"],
        "temperature_range": {
            "min": current_settings["temp_range_min"],
            "max": current_settings["temp_range_max"],
        },
        "error": camera_error,
    })


@app.route('/stream', methods=['GET'])
def stream():
    """
    MJPEG live stream — serves continuous thermal frames as multipart JPEG.
    Connect via <img src="http://localhost:5050/stream" /> in the browser.
    """
    def generate_frames():
        while True:
            temp_array = grab_frame()
            colorized = temperature_to_colormap(
                temp_array,
                palette=current_settings["palette"],
                temp_min=current_settings["temp_range_min"],
                temp_max=current_settings["temp_range_max"],
            )
            # Add scale bar
            with_scale = add_temperature_scale(
                colorized,
                temp_min=current_settings["temp_range_min"],
                temp_max=current_settings["temp_range_max"],
                palette=current_settings["palette"],
            )
            jpeg = colorized_to_jpeg(with_scale)

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')

            # ~15 FPS
            time.sleep(0.067)

    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


@app.route('/capture', methods=['POST'])
def capture():
    """
    Capture a single frame: saves radiometric TIFF + display JPEG + thumbnail.

    Request body: { "view_type": "front" }
    Returns: { radiometric_path, display_path, thumbnail_path, min_temp, max_temp, avg_temp, timestamp }
    """
    data = request.get_json() or {}
    view_type = data.get("view_type", "front")

    # Ensure capture directory exists
    os.makedirs(CAPTURE_DIR, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"{view_type}_{timestamp}"

    # Grab frame
    temp_array = grab_frame()

    # Save radiometric TIFF (full precision temperature data)
    tiff_path = os.path.join(CAPTURE_DIR, f"{base_name}_radiometric.tiff")
    save_radiometric_tiff(temp_array, tiff_path)

    # Generate and save display image
    colorized = temperature_to_colormap(
        temp_array,
        palette=current_settings["palette"],
        temp_min=current_settings["temp_range_min"],
        temp_max=current_settings["temp_range_max"],
    )
    with_scale = add_temperature_scale(
        colorized,
        temp_min=current_settings["temp_range_min"],
        temp_max=current_settings["temp_range_max"],
        palette=current_settings["palette"],
    )
    display_jpeg = colorized_to_jpeg(with_scale)
    display_path = os.path.join(CAPTURE_DIR, f"{base_name}_display.jpg")
    with open(display_path, 'wb') as f:
        f.write(display_jpeg)

    # Generate and save thumbnail
    thumb_jpeg = generate_thumbnail(colorized)
    thumb_path = os.path.join(CAPTURE_DIR, f"{base_name}_thumb.jpg")
    with open(thumb_path, 'wb') as f:
        f.write(thumb_jpeg)

    # Temperature statistics
    min_temp = round(float(np.min(temp_array)), 2)
    max_temp = round(float(np.max(temp_array)), 2)
    avg_temp = round(float(np.mean(temp_array)), 2)

    return jsonify({
        "radiometric_path": tiff_path,
        "display_path": display_path,
        "thumbnail_path": thumb_path,
        "min_temp": min_temp,
        "max_temp": max_temp,
        "avg_temp": avg_temp,
        "ambient_temp": None,
        "timestamp": datetime.datetime.now().isoformat(),
        "view_type": view_type,
        "palette": current_settings["palette"],
        "emissivity": current_settings["emissivity"],
    })


@app.route('/capture-file/<path:filename>', methods=['GET'])
def serve_capture(filename):
    """Serve a captured image file."""
    filepath = os.path.join(CAPTURE_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    return send_file(filepath)


@app.route('/analyze-region', methods=['POST'])
def analyze_region():
    """
    Analyze temperature statistics for a specific region of a captured image.

    Request body: { "tiff_path": "...", "bounds": { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1 } }
    Returns: { min, max, avg, std, median }
    """
    data = request.get_json() or {}
    tiff_path = data.get("tiff_path")
    bounds = data.get("bounds")

    if not tiff_path or not bounds:
        return jsonify({"error": "tiff_path and bounds required"}), 400

    try:
        from thermal_processor import load_radiometric_tiff
        temp_array = load_radiometric_tiff(tiff_path)
        stats = extract_region_stats(temp_array, bounds)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/settings', methods=['GET'])
def get_settings():
    """Current camera settings."""
    return jsonify(current_settings)


@app.route('/settings', methods=['PUT'])
def update_settings():
    """Update camera settings (emissivity, palette, temperature range)."""
    data = request.get_json() or {}

    if "emissivity" in data:
        val = float(data["emissivity"])
        if 0.1 <= val <= 1.0:
            current_settings["emissivity"] = val

    if "palette" in data:
        if data["palette"] in ("ironbow", "rainbow", "arctic", "gray"):
            current_settings["palette"] = data["palette"]

    if "temp_range_min" in data:
        current_settings["temp_range_min"] = float(data["temp_range_min"])
    if "temp_range_max" in data:
        current_settings["temp_range_max"] = float(data["temp_range_max"])

    return jsonify(current_settings)


# ============================================================
# Startup
# ============================================================

if __name__ == '__main__':
    print("[TWC Thermography] Starting camera service...")
    init_camera()
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    print(f"[TWC Thermography] Camera service running on http://{HOST}:{PORT}")
    print(f"[TWC Thermography] Simulation mode: {use_simulation}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
