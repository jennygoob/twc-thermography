"""
TWC Thermography - Screen Capture Camera Bridge
Captures the thermal feed from the ThermoVision software window
and serves it as MJPEG stream on port 5050.

Run with 32-bit Python: py -3.12-32 camera_capture.py
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

# State
camera_connected = False
camera_error = None
use_simulation = False
thermal_window = None
current_settings = {
    "emissivity": DEFAULT_EMISSIVITY,
    "palette": DEFAULT_PALETTE,
    "temp_range_min": TEMP_RANGE_MIN,
    "temp_range_max": TEMP_RANGE_MAX,
}
frame_lock = threading.Lock()


def find_thermal_window():
    """Find the ThermoVision software window."""
    try:
        import win32gui
        import win32con

        found = []

        def callback(hwnd, results):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if title:
                    title_lower = title.lower()
                    # Skip browser windows
                    if any(skip in title_lower for skip in ["edge", "chrome", "firefox", "browser"]):
                        return
                    # Look for ThermoVision/FLIR windows
                    if any(kw in title_lower for kw in ["thermovision", "flir", "acam", "irmonitor", "thermal", "a300", "a-300"]):
                        results.append((hwnd, title))
                    # ThermoVision study windows have "Study ID" in title
                    if "study id" in title_lower or "full body" in title_lower or "disconnect" in title_lower:
                        results.append((hwnd, title))

        win32gui.EnumWindows(callback, found)
        return found

    except ImportError:
        print("[Camera] win32gui not available")
        return []


def capture_window(hwnd):
    """Capture a screenshot of a specific window."""
    try:
        import win32gui
        import win32ui
        import win32con

        # Get window dimensions
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top

        if width <= 0 or height <= 0:
            return None

        # Get window DC
        hwndDC = win32gui.GetWindowDC(hwnd)
        mfcDC = win32ui.CreateDCFromHandle(hwndDC)
        saveDC = mfcDC.CreateCompatibleDC()

        # Create bitmap
        saveBitMap = win32ui.CreateBitmap()
        saveBitMap.CreateCompatibleBitmap(mfcDC, width, height)
        saveDC.SelectObject(saveBitMap)

        # Copy window to bitmap
        result = saveDC.BitBlt((0, 0), (width, height), mfcDC, (0, 0), win32con.SRCCOPY)

        # Convert to numpy array
        bmpinfo = saveBitMap.GetInfo()
        bmpstr = saveBitMap.GetBitmapBits(True)

        img = np.frombuffer(bmpstr, dtype=np.uint8)
        img = img.reshape((height, width, 4))  # BGRA
        img = img[:, :, :3]  # BGR

        # Cleanup
        win32gui.DeleteObject(saveBitMap.GetHandle())
        saveDC.DeleteDC()
        mfcDC.DeleteDC()
        win32gui.ReleaseDC(hwnd, hwndDC)

        return img

    except Exception as e:
        print(f"[Camera] Window capture error: {e}")
        return None


def capture_thermal_region(hwnd):
    """Capture just the thermal image area from the window."""
    img = capture_window(hwnd)
    if img is None:
        return None

    h, w = img.shape[:2]

    # The thermal image is typically in the left portion of the window
    # Crop out the right-side controls panel
    # Based on the screenshot, thermal image is roughly the left 60% of window
    thermal_width = int(w * 0.55)
    thermal_img = img[30:h-30, 10:thermal_width]  # Trim borders

    return thermal_img


def thermal_to_temperature(img):
    """Convert a thermal colormap image back to approximate temperature array."""
    if img is None:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    # Convert to grayscale for temperature approximation
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)

    # Map pixel values to temperature range
    temp_array = gray / 255.0 * (current_settings["temp_range_max"] - current_settings["temp_range_min"]) + current_settings["temp_range_min"]

    # Resize to standard output
    temp_array = cv2.resize(temp_array, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_LINEAR)

    return temp_array


def init_camera():
    """Find and connect to the ThermoVision software window."""
    global camera_connected, camera_error, use_simulation, thermal_window

    print("[Camera] Searching for ThermoVision software window...")

    windows = find_thermal_window()

    if windows:
        for hwnd, title in windows:
            print(f"[Camera] Found window: '{title}' (hwnd={hwnd})")

        # Use the first matching window
        thermal_window = windows[0][0]
        window_title = windows[0][1]

        # Test capture
        img = capture_window(thermal_window)
        if img is not None:
            print(f"[Camera] Window capture working: {img.shape}")
            camera_connected = True
            camera_error = None
            use_simulation = False
            print(f"[Camera] Connected to '{window_title}' - capturing thermal feed")
            return
        else:
            print("[Camera] Window found but capture failed")

    else:
        print("[Camera] No ThermoVision window found")
        print("[Camera] Make sure the ThermoVision software is open and showing the camera feed")

    # List ALL visible windows to help find the right one
    print()
    print("[Camera] All visible windows:")
    try:
        import win32gui
        def list_callback(hwnd, results):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if title and len(title) > 2:
                    print(f"  [{hwnd}] {title}")
        win32gui.EnumWindows(list_callback, None)
    except:
        pass

    camera_error = "ThermoVision software window not found - open it first"
    camera_connected = False
    use_simulation = True


def grab_frame():
    """Grab a frame from the ThermoVision window."""
    global thermal_window

    if use_simulation or thermal_window is None:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    with frame_lock:
        img = capture_thermal_region(thermal_window)
        if img is not None:
            return thermal_to_temperature(img)

    return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)


def grab_raw_frame():
    """Grab the raw BGR image from the thermal window (for direct display)."""
    global thermal_window

    if thermal_window is None:
        return None

    with frame_lock:
        return capture_thermal_region(thermal_window)


# ============================================================
# Routes
# ============================================================

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "connected": camera_connected or use_simulation,
        "simulation_mode": use_simulation,
        "camera_model": "FLIR A300 (via ThermoVision)" if camera_connected else "Simulation",
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
    })


@app.route("/stream", methods=["GET"])
def stream():
    def generate_frames():
        while True:
            if not use_simulation and thermal_window is not None:
                # Grab the raw thermal image directly (already colorized by ThermoVision)
                raw = grab_raw_frame()
                if raw is not None:
                    # Resize to standard size
                    resized = cv2.resize(raw, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
                    _, jpeg = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n")
                    time.sleep(0.1)  # ~10 FPS for screen capture
                    continue

            # Fallback to simulation
            temp_array = generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)
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

    # Also save the raw thermal image if available
    raw = grab_raw_frame()
    if raw is not None:
        raw_resized = cv2.resize(raw, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
        colorized = raw_resized
    else:
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


@app.route("/reconnect", methods=["POST"])
def reconnect():
    """Re-scan for the ThermoVision window."""
    init_camera()
    return jsonify({"connected": camera_connected, "simulation_mode": use_simulation, "error": camera_error})


if __name__ == "__main__":
    print("[TWC Thermography] Starting screen capture camera bridge...")
    print(f"[TWC Thermography] Python {sys.version}")
    print("[TWC Thermography] Make sure ThermoVision software is open with camera feed visible")
    print()
    init_camera()
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    print()
    print(f"[TWC Thermography] Camera bridge running on http://{HOST}:{PORT}")
    print(f"[TWC Thermography] Simulation mode: {use_simulation}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
