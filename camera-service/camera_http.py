"""
TWC Thermography - HTTP Camera Bridge
Connects to FLIR A300 via its built-in HTTP interface.
Grabs frames and serves them as MJPEG stream on port 5050.
"""

import time
import threading
import datetime
import os
import io
import struct
import socket
import numpy as np
import cv2
from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS

from config import HOST, PORT, CAPTURE_DIR, DEFAULT_EMISSIVITY, TEMP_RANGE_MIN, TEMP_RANGE_MAX, DEFAULT_PALETTE, OUTPUT_WIDTH, OUTPUT_HEIGHT
from thermal_processor import temperature_to_colormap, colorized_to_jpeg, generate_thumbnail, save_radiometric_tiff, add_temperature_scale, extract_region_stats, generate_simulated_thermal

app = Flask(__name__)
CORS(app, origins="*")

# Camera config
CAMERA_IP = "169.254.79.43"
CAMERA_HTTP_PORT = 80

# State
camera_connected = False
camera_error = None
use_simulation = False
current_settings = {
    "emissivity": DEFAULT_EMISSIVITY,
    "palette": DEFAULT_PALETTE,
    "temp_range_min": TEMP_RANGE_MIN,
    "temp_range_max": TEMP_RANGE_MAX,
}

latest_frame = None
frame_lock = threading.Lock()


def try_http_snapshot():
    """Try to grab a snapshot from the FLIR A300 HTTP interface."""
    import urllib.request

    # Common FLIR A300 image endpoints
    endpoints = [
        f"http://{CAMERA_IP}/image.jpg",
        f"http://{CAMERA_IP}/snapshot.jpg",
        f"http://{CAMERA_IP}/img/ir.jpg",
        f"http://{CAMERA_IP}/api/image/current",
        f"http://{CAMERA_IP}/jpg/image.jpg",
        f"http://{CAMERA_IP}/image",
        f"http://{CAMERA_IP}/snapshot",
        f"http://{CAMERA_IP}/image/jpeg.cgi",
        f"http://{CAMERA_IP}/cgi-bin/image.cgi",
        f"http://{CAMERA_IP}/now.jpg",
        f"http://{CAMERA_IP}/video.mjpg",
        f"http://{CAMERA_IP}/mjpg/video.mjpg",
        f"http://{CAMERA_IP}/axis-cgi/jpg/image.cgi",
        f"http://{CAMERA_IP}/ISAPI/Streaming/channels/1/picture",
    ]

    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=3)
            data = resp.read()
            if len(data) > 1000:  # Looks like an image
                nparr = np.frombuffer(data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img is not None:
                    print(f"[Camera] HTTP snapshot working: {url}")
                    return url, img
        except Exception:
            continue
    return None, None


def try_rtsp_stream():
    """Try RTSP stream from the camera."""
    rtsp_urls = [
        f"rtsp://{CAMERA_IP}/stream1",
        f"rtsp://{CAMERA_IP}/live",
        f"rtsp://{CAMERA_IP}:554/stream1",
        f"rtsp://{CAMERA_IP}:554/live",
    ]

    for url in rtsp_urls:
        try:
            cap = cv2.VideoCapture(url)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    print(f"[Camera] RTSP stream working: {url}")
                    return url, cap
            cap.release()
        except Exception:
            continue
    return None, None


def try_gige_raw():
    """Try raw GigE Vision GVSP stream on port 3956."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2)

        # GigE Vision discovery packet
        discovery = b'\x42\x01\x00\x02\x00\x00\x00\x00'
        sock.sendto(discovery, (CAMERA_IP, 3956))

        try:
            data, addr = sock.recvfrom(4096)
            print(f"[Camera] GigE Vision response from {addr}: {len(data)} bytes")
            sock.close()
            return True
        except socket.timeout:
            sock.close()
            return False
    except Exception as e:
        print(f"[Camera] GigE probe error: {e}")
        return False


def init_camera():
    """Try multiple methods to connect to the FLIR A300."""
    global camera_connected, camera_error, use_simulation

    print(f"[Camera] Attempting to connect to FLIR A300 at {CAMERA_IP}...")

    # Test basic connectivity
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex((CAMERA_IP, 80))
        sock.close()
        if result == 0:
            print(f"[Camera] HTTP port 80 is open on {CAMERA_IP}")
        else:
            print(f"[Camera] HTTP port 80 is closed on {CAMERA_IP}")
    except Exception as e:
        print(f"[Camera] TCP probe failed: {e}")

    # Method 1: HTTP snapshot
    print("[Camera] Trying HTTP snapshot endpoints...")
    url, img = try_http_snapshot()
    if url:
        camera_connected = True
        camera_error = None
        use_simulation = False
        print(f"[Camera] Connected via HTTP: {url}")
        return

    # Method 2: RTSP
    print("[Camera] Trying RTSP streams...")
    url, cap = try_rtsp_stream()
    if url:
        camera_connected = True
        camera_error = None
        use_simulation = False
        if cap:
            cap.release()
        print(f"[Camera] Connected via RTSP: {url}")
        return

    # Method 3: GigE Vision raw
    print("[Camera] Trying GigE Vision protocol...")
    if try_gige_raw():
        print("[Camera] GigE Vision device found but need SDK for streaming")
        camera_error = "GigE Vision device found - need ThermoVision SDK for streaming. Using simulation mode."
        camera_connected = True
        use_simulation = True
        return

    # Fallback to simulation
    print("[Camera] All methods failed - falling back to simulation mode")
    camera_error = f"Could not connect to camera at {CAMERA_IP} - using simulation mode"
    camera_connected = False
    use_simulation = True


def grab_frame():
    """Grab a thermal frame."""
    if use_simulation:
        return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)

    # Try HTTP snapshot
    try:
        import urllib.request
        req = urllib.request.Request(f"http://{CAMERA_IP}/image.jpg", headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=3)
        data = resp.read()
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            # Convert to grayscale temperature-like array
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
            temp_array = gray / 255.0 * (TEMP_RANGE_MAX - TEMP_RANGE_MIN) + TEMP_RANGE_MIN
            return temp_array
    except Exception:
        pass

    return generate_simulated_thermal(OUTPUT_WIDTH, OUTPUT_HEIGHT)


# ============================================================
# Routes (same API as camera_server.py)
# ============================================================

@app.route('/status', methods=['GET'])
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


@app.route('/stream', methods=['GET'])
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
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')
            time.sleep(0.067)

    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


@app.route('/capture', methods=['POST'])
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
    with open(display_path, 'wb') as f:
        f.write(display_jpeg)

    thumb_jpeg = generate_thumbnail(colorized)
    thumb_path = os.path.join(CAPTURE_DIR, f"{base_name}_thumb.jpg")
    with open(thumb_path, 'wb') as f:
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


@app.route('/capture-file/<path:filename>', methods=['GET'])
def serve_capture(filename):
    filepath = os.path.join(CAPTURE_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    return send_file(filepath)


@app.route('/analyze-region', methods=['POST'])
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


@app.route('/settings', methods=['GET'])
def get_settings():
    return jsonify(current_settings)


@app.route('/settings', methods=['PUT'])
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


if __name__ == '__main__':
    print("[TWC Thermography] Starting HTTP camera bridge...")
    init_camera()
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    print(f"[TWC Thermography] Camera bridge running on http://{HOST}:{PORT}")
    print(f"[TWC Thermography] Simulation mode: {use_simulation}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
