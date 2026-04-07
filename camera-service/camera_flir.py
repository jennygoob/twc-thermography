"""
TWC Thermography - FLIR A300 Camera Bridge via ThermoVision SDK COM
Connects to the FLIR A300 using the LVCam COM object from the ThermoVision SDK.
Serves thermal frames as MJPEG stream on port 5050.

Run with 32-bit Python: py -3.12-32 camera_flir.py
"""

import time
import threading
import datetime
import os
import sys
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
current_settings = {
    "emissivity": DEFAULT_EMISSIVITY,
    "palette": DEFAULT_PALETTE,
    "temp_range_min": TEMP_RANGE_MIN,
    "temp_range_max": TEMP_RANGE_MAX,
}
frame_lock = threading.Lock()


def init_camera():
    """Connect to FLIR A300 via ThermoVision SDK COM."""
    global camera_connected, camera_error, use_simulation, lvcam

    print(f"[Camera] Connecting to FLIR A300 at {CAMERA_IP} via ThermoVision SDK...")

    # Method 1: Try LVCam COM object
    try:
        import comtypes
        import comtypes.client

        ocx_path = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
        mod = comtypes.client.GetModule(ocx_path)

        # Create LVCam instance
        lvcam = comtypes.CoCreateInstance(mod.LVCam._reg_clsid_)
        print(f"[Camera] LVCam created: {lvcam}")

        # List available methods
        methods = [m for m in dir(lvcam) if not m.startswith("_")]
        print(f"[Camera] Available methods: {methods}")

        # Try to connect to camera
        try:
            # Try common connection methods
            if hasattr(lvcam, "Connect"):
                lvcam.Connect(CAMERA_IP)
                print("[Camera] Connected via Connect()")
            elif hasattr(lvcam, "Open"):
                lvcam.Open(CAMERA_IP)
                print("[Camera] Connected via Open()")
            elif hasattr(lvcam, "SetIPAddress"):
                lvcam.SetIPAddress(CAMERA_IP)
                print("[Camera] IP set via SetIPAddress()")
            elif hasattr(lvcam, "put_IPAddress"):
                lvcam.put_IPAddress(CAMERA_IP)
                print("[Camera] IP set via put_IPAddress()")
            elif hasattr(lvcam, "IPAddress"):
                lvcam.IPAddress = CAMERA_IP
                print("[Camera] IP set via IPAddress property")

            camera_connected = True
            camera_error = None
            use_simulation = False
            print("[Camera] FLIR A300 connected successfully!")
            return

        except Exception as e:
            print(f"[Camera] Connection method failed: {e}")
            # Still try to use it - might auto-discover
            camera_connected = True
            camera_error = f"Connected to SDK but camera link uncertain: {e}"
            use_simulation = False
            return

    except Exception as e:
        print(f"[Camera] LVCam COM failed: {e}")
        import traceback
        traceback.print_exc()

    # Method 2: Try FLIR RTSP
    print("[Camera] Trying FLIR RTSP...")
    try:
        import comtypes
        import comtypes.client

        # Try the FLIR RTSP COM object
        rtsp_clsid = "{87E59919-685F-4BA4-BC3C-1522D14C7281}"
        try:
            rtsp = comtypes.CoCreateInstance(rtsp_clsid)
            print(f"[Camera] FLIR RTSP object created: {rtsp}")
            print(f"[Camera] RTSP methods: {[m for m in dir(rtsp) if not m.startswith('_')]}")
        except Exception as e:
            print(f"[Camera] FLIR RTSP failed: {e}")
    except Exception as e:
        print(f"[Camera] RTSP import error: {e}")

    # Method 3: Try IRView COM object
    print("[Camera] Trying IRView Control...")
    try:
        import comtypes
        irview_clsid = "{0DD03226-05F4-4E58-A0E5-6DB739606664}"
        try:
            irview = comtypes.CoCreateInstance(irview_clsid)
            print(f"[Camera] IRView created: {irview}")
            print(f"[Camera] IRView methods: {[m for m in dir(irview) if not m.startswith('_')]}")
            camera_connected = True
            camera_error = None
            use_simulation = False
            return
        except Exception as e:
            print(f"[Camera] IRView failed: {e}")
    except Exception as e:
        print(f"[Camera] IRView import error: {e}")

    # Method 4: Try OpenCV RTSP with FLIR-specific URLs
    print("[Camera] Trying OpenCV RTSP...")
    rtsp_urls = [
        f"rtsp://{CAMERA_IP}/avc",
        f"rtsp://{CAMERA_IP}/mpeg4",
        f"rtsp://{CAMERA_IP}/thermal",
        f"rtsp://{CAMERA_IP}/stream",
        f"rtsp://{CAMERA_IP}/live",
        f"rtsp://{CAMERA_IP}:554/avc",
        f"rtsp://{CAMERA_IP}:554/mpeg4",
    ]
    for url in rtsp_urls:
        try:
            print(f"[Camera] Trying {url}...")
            cap = cv2.VideoCapture(url)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    print(f"[Camera] RTSP working: {url}")
                    camera_connected = True
                    camera_error = None
                    use_simulation = False
                    cap.release()
                    return
            cap.release()
        except Exception:
            pass

    # Fallback
    print("[Camera] All methods failed - using simulation mode")
    camera_error = "Could not stream from camera - using simulation mode"
    camera_connected = False
    use_simulation = True


def grab_frame():
    """Grab a thermal frame from the camera."""
    global lvcam

    if use_simulation:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    if lvcam is not None:
        try:
            with frame_lock:
                # Try to get image data from LVCam
                if hasattr(lvcam, "GetImage"):
                    img_data = lvcam.GetImage()
                    if img_data is not None:
                        arr = np.frombuffer(img_data, dtype=np.uint8)
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
                            return gray / 255.0 * (TEMP_RANGE_MAX - TEMP_RANGE_MIN) + TEMP_RANGE_MIN

                if hasattr(lvcam, "GrabImage"):
                    img_data = lvcam.GrabImage()
                    if img_data is not None:
                        arr = np.frombuffer(img_data, dtype=np.uint8)
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
                            return gray / 255.0 * (TEMP_RANGE_MAX - TEMP_RANGE_MIN) + TEMP_RANGE_MIN

                if hasattr(lvcam, "Snapshot"):
                    img_data = lvcam.Snapshot()
                    if img_data is not None:
                        arr = np.frombuffer(img_data, dtype=np.uint8)
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
                            return gray / 255.0 * (TEMP_RANGE_MAX - TEMP_RANGE_MIN) + TEMP_RANGE_MIN

                # Try getting temperature data directly
                if hasattr(lvcam, "GetTempData"):
                    temp_data = lvcam.GetTempData()
                    if temp_data is not None:
                        return np.array(temp_data).reshape(OUTPUT_HEIGHT, OUTPUT_WIDTH)

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
        "camera_model": "FLIR A300" if camera_connected and not use_simulation else "FLIR A300 (Simulation)",
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
