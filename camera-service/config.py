# FLIR A300 Camera Configuration
# Modify these values to match your camera setup

CAMERA_IP = "192.168.1.100"          # A300 GigE Vision address
CAMERA_PORT = 3956                    # GigE Vision control port (GVCP)
STREAM_PORT = 20202                   # GigE Vision stream port (GVSP)

DEFAULT_EMISSIVITY = 0.98             # Human skin emissivity
TEMP_RANGE_MIN = 20.0                 # Celsius — lower bound for colormap
TEMP_RANGE_MAX = 40.0                 # Celsius — upper bound for colormap
DEFAULT_PALETTE = "ironbow"           # ironbow | rainbow | arctic | gray

CAPTURE_DIR = "/tmp/thermography_captures"
WATCH_DIR = None                      # Set to a folder path for FLIR Tools export fallback

# Flask server
HOST = "0.0.0.0"
PORT = 5050

# Image output
OUTPUT_WIDTH = 640
OUTPUT_HEIGHT = 480
JPEG_QUALITY = 92
THUMBNAIL_SIZE = (160, 120)

# Colormaps (OpenCV constants mapped to names)
COLORMAPS = {
    "ironbow": 1,      # COLORMAP_HOT variant
    "rainbow": 4,      # COLORMAP_RAINBOW
    "arctic": 11,      # COLORMAP_COOL
    "gray": -1,        # Grayscale (no colormap)
}
