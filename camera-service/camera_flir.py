"""
TWC Thermography - FLIR A300 Camera Bridge via ThermoVision SDK COM
Connects to the FLIR A300 using LVCam COM object.
Serves thermal frames as MJPEG stream on port 5050.

Run with 32-bit Python: py -3.12-32 camera_flir.py
"""

import time
import threading
import datetime
import os
import sys
import array
import ctypes
import numpy as np
import cv2
from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS

from config import HOST, PORT, CAPTURE_DIR, DEFAULT_EMISSIVITY, TEMP_RANGE_MIN, TEMP_RANGE_MAX, DEFAULT_PALETTE, OUTPUT_WIDTH, OUTPUT_HEIGHT
from thermal_processor import temperature_to_colormap, colorized_to_jpeg, generate_thumbnail, save_radiometric_tiff, add_temperature_scale, generate_simulated_thermal

app = Flask(__name__)
CORS(app, origins="*")

# Camera config
CAMERA_IP = "169.254.79.43"

# State
camera_connected = False
camera_error = None
use_simulation = False
lvcam = None
lvcam_mod = None
current_settings = {
    "emissivity": DEFAULT_EMISSIVITY,
    "palette": DEFAULT_PALETTE,
    "temp_range_min": TEMP_RANGE_MIN,
    "temp_range_max": TEMP_RANGE_MAX,
}
frame_lock = threading.Lock()


def init_camera():
    """Connect to FLIR A300 via ThermoVision SDK COM."""
    global camera_connected, camera_error, use_simulation, lvcam, lvcam_mod

    print(f"[Camera] Connecting to FLIR A300 at {CAMERA_IP} via ThermoVision SDK...")

    try:
        import comtypes
        import comtypes.client

        ocx_path = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
        lvcam_mod = comtypes.client.GetModule(ocx_path)

        # Create LVCam instance
        cam = comtypes.CoCreateInstance(lvcam_mod.LVCam._reg_clsid_)
        print(f"[Camera] LVCam created")

        # Get the _DLVCam dispatch interface
        DLVCam = lvcam_mod._DLVCam
        lvcam = cam.QueryInterface(DLVCam)
        print(f"[Camera] Got _DLVCam interface")

        # Check version
        try:
            ver = lvcam.Version()
            print(f"[Camera] SDK Version: {ver}")
        except Exception as e:
            print(f"[Camera] Version check: {e}")

        # Try to connect to camera via SubmitCamCommand
        try:
            # Common FLIR connect commands
            result = lvcam.SubmitCamCommand(f"connect {CAMERA_IP}")
            print(f"[Camera] Connect command result: {result}")
        except Exception as e:
            print(f"[Camera] SubmitCamCommand connect: {e}")

        # Try DoCameraAction to connect
        try:
            result = lvcam.DoCameraAction("connect", CAMERA_IP)
            print(f"[Camera] DoCameraAction connect: {result}")
        except Exception as e:
            print(f"[Camera] DoCameraAction: {e}")

        # Try SetCameraProperty with IP
        try:
            lvcam.SetCameraProperty("IPAddress", CAMERA_IP)
            print(f"[Camera] SetCameraProperty IP: OK")
        except Exception as e:
            print(f"[Camera] SetCameraProperty: {e}")

        # Try getting an image to verify connection
        try:
            img = lvcam.GetImage()
            print(f"[Camera] GetImage result: type={type(img)}, value={img}")
            if img is not None:
                camera_connected = True
                camera_error = None
                use_simulation = False
                print("[Camera] FLIR A300 streaming!")
                return
        except Exception as e:
            print(f"[Camera] GetImage: {e}")

        # Try GetImages
        try:
            result = lvcam.GetImages(0, None, None, None, None)
            print(f"[Camera] GetImages result: {result}")
        except Exception as e:
            print(f"[Camera] GetImages: {e}")

        # Try NLGetImages
        try:
            result = lvcam.NLGetImages()
            print(f"[Camera] NLGetImages result: type={type(result)}")
            if result is not None:
                camera_connected = True
                camera_error = None
                use_simulation = False
                print("[Camera] FLIR A300 streaming via NLGetImages!")
                return
        except Exception as e:
            print(f"[Camera] NLGetImages: {e}")

        # Try GetAllImages
        try:
            result = lvcam.GetAllImages()
            print(f"[Camera] GetAllImages result: type={type(result)}")
            if result is not None:
                camera_connected = True
                camera_error = None
                use_simulation = False
                print("[Camera] FLIR A300 streaming via GetAllImages!")
                return
        except Exception as e:
            print(f"[Camera] GetAllImages: {e}")

        # Try Temperature at center pixel
        try:
            temp = lvcam.Temperature(160, 120, 0.0)
            print(f"[Camera] Temperature(160,120): {temp}")
            if temp is not None and temp > 0:
                camera_connected = True
                camera_error = None
                use_simulation = False
                print("[Camera] FLIR A300 temperature reading works!")
                return
        except Exception as e:
            print(f"[Camera] Temperature: {e}")

        # Try Emissivity
        try:
            em = lvcam.Emissivity
            print(f"[Camera] Current emissivity: {em}")
        except Exception as e:
            print(f"[Camera] Emissivity: {e}")

        # Try GetCameraProperty
        try:
            props = ["SerialNumber", "ModelName", "IPAddress", "Width", "Height", "FirmwareVersion"]
            for prop in props:
                try:
                    val = lvcam.GetCameraProperty(prop)
                    print(f"[Camera] Property {prop}: {val}")
                except:
                    pass
        except Exception as e:
            print(f"[Camera] GetCameraProperty: {e}")

        # If we got here, COM object works but we need to figure out the right method
        print("[Camera] COM object active but image grab method needs tuning")
        camera_connected = True
        camera_error = "COM connected, testing image methods"
        use_simulation = True
        return

    except Exception as e:
        print(f"[Camera] COM initialization failed: {e}")
        import traceback
        traceback.print_exc()

    # Fallback
    print("[Camera] Falling back to simulation mode")
    camera_error = "Could not connect to camera"
    camera_connected = False
    use_simulation = True


def grab_frame():
    """Grab a thermal frame from the camera."""
    global lvcam

    if use_simulation or lvcam is None:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    try:
        with frame_lock:
            # Try GetImage
            try:
                img_data = lvcam.GetImage()
                if img_data is not None:
                    if isinstance(img_data, (bytes, bytearray)):
                        nparr = np.frombuffer(img_data, dtype=np.uint16)
                        if len(nparr) >= OUTPUT_WIDTH * OUTPUT_HEIGHT:
                            temp_array = nparr[:OUTPUT_WIDTH * OUTPUT_HEIGHT].reshape(OUTPUT_HEIGHT, OUTPUT_WIDTH).astype(np.float64)
                            temp_array = temp_array / 100.0  # Convert from centi-kelvin to celsius
                            return temp_array
                    elif hasattr(img_data, '__len__'):
                        arr = np.array(img_data, dtype=np.float64)
                        if arr.size >= OUTPUT_WIDTH * OUTPUT_HEIGHT:
                            return arr[:OUTPUT_WIDTH * OUTPUT_HEIGHT].reshape(OUTPUT_HEIGHT, OUTPUT_WIDTH)
            except Exception as e:
                pass

            # Try NLGetImages
            try:
                result = lvcam.NLGetImages()
                if result is not None:
                    if isinstance(result, tuple) and len(result) > 0:
                        img_data = result[0]
                        if isinstance(img_data, (bytes, bytearray)):
                            nparr = np.frombuffer(img_data, dtype=np.uint16)
                            if len(nparr) >= OUTPUT_WIDTH * OUTPUT_HEIGHT:
                                temp_array = nparr[:OUTPUT_WIDTH * OUTPUT_HEIGHT].reshape(OUTPUT_HEIGHT, OUTPUT_WIDTH).astype(np.float64)
                                temp_array = temp_array / 100.0
                                return temp_array
            except Exception:
                pass

            # Try Temperature pixel-by-pixel (slow but works)
            try:
                # Sample a grid of temperatures
                grid_w, grid_h = 64, 48  # Downsampled grid
                temp_grid = np.zeros((grid_h, grid_w), dtype=np.float64)
                for y in range(grid_h):
                    for x in range(grid_w):
                        px = int(x * 320 / grid_w)
                        py = int(y * 240 / grid_h)
                        try:
                            t = lvcam.Temperature(px, py, 0.0)
                            if t is not None:
                                temp_grid[y, x] = float(t)
                        except:
                            temp_grid[y, x] = 30.0
                # Upscale to full resolution
                temp_array = cv2.resize(temp_grid, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_LINEAR)
                return temp_array
            except Exception:
                pass

    except Exception as e:
        print(f"[Camera] Frame grab error: {e}")

    return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)


# ============================================================
# Routes
# ============================================================

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "connected": camera_connected or use_simulation,
        "simulation_mode": use_simulation,
        "camera_model": "FLIR A300" if camera_connected else "FLIR A300 (Simulation)",
        "serial_number": "48220770",
        "firmware_version": None,
        "sensor_temperature_celsius": None,
        "current_palette": current_settings["palette"],
        "emissivity": current_settings["emissivity"],
        "temperature_range": {
            "min": current_settings["temp_range_min"],
            "max": current_settings["temp_range_max"],
        },
        "error": camera_error,
        "camera_ip": CAMERA_IP,
    })


@app.route("/stream", methods=["GET"])
def stream():
    def generate_frames():
        while True:
            temp_array = grab_frame()
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
            jpeg = colorized_to_jpeg(with_scale)
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")
            time.sleep(0.067)

    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/capture", methods=["POST"])
def capture():
    data = request.get_json() or {}
    view_type = data.get("view_type", "front")
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"{view_type}_{timestamp}"

    temp_array = grab_frame()

    tiff_path = os.path.join(CAPTURE_DIR, f"{base_name}_radiometric.tiff")
    save_radiometric_tiff(temp_array, tiff_path)

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
    with open(display_path, "wb") as f:
        f.write(display_jpeg)

    thumb_jpeg = generate_thumbnail(colorized)
    thumb_path = os.path.join(CAPTURE_DIR, f"{base_name}_thumb.jpg")
    with open(thumb_path, "wb") as f:
        f.write(thumb_jpeg)

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


@app.route("/capture-file/<path:filename>", methods=["GET"])
def serve_capture(filename):
    filepath = os.path.join(CAPTURE_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    return send_file(filepath)


@app.route("/analyze-region", methods=["POST"])
def analyze_region():
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


@app.route("/settings", methods=["GET"])
def get_settings():
    return jsonify(current_settings)


@app.route("/settings", methods=["PUT"])
def update_settings():
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


if __name__ == "__main__":
    print("[TWC Thermography] Starting FLIR A300 camera bridge (32-bit COM)...")
    print(f"[TWC Thermography] Python {sys.version}")
    init_camera()
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    print(f"[TWC Thermography] Camera bridge running on http://{HOST}:{PORT}")
    print(f"[TWC Thermography] Simulation mode: {use_simulation}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
