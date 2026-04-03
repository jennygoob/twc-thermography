"""
Thermal image processing — converts radiometric data to false-color images
and extracts temperature statistics for analysis.
"""

import numpy as np
import cv2
from PIL import Image
import io
import os
from config import (
    TEMP_RANGE_MIN, TEMP_RANGE_MAX, DEFAULT_PALETTE,
    OUTPUT_WIDTH, OUTPUT_HEIGHT, JPEG_QUALITY, THUMBNAIL_SIZE, COLORMAPS
)


def radiometric_to_temperature(raw_16bit: np.ndarray,
                                calibration_offset: float = 0.0,
                                calibration_scale: float = 0.04) -> np.ndarray:
    """
    Convert 16-bit radiometric pixel values to temperature in Celsius.

    The FLIR A300 stores raw radiance values as 16-bit integers.
    Temperature = (raw_value * scale) + offset - 273.15 (Kelvin to Celsius)

    Default calibration values are approximate — adjust per camera calibration.
    """
    temp_kelvin = (raw_16bit.astype(np.float64) * calibration_scale) + calibration_offset
    temp_celsius = temp_kelvin - 273.15
    return temp_celsius


def temperature_to_colormap(temp_array: np.ndarray,
                             palette: str = DEFAULT_PALETTE,
                             temp_min: float = TEMP_RANGE_MIN,
                             temp_max: float = TEMP_RANGE_MAX) -> np.ndarray:
    """
    Map temperature values to RGB false-color image using a thermal palette.
    Returns a BGR numpy array suitable for OpenCV operations.
    """
    # Normalize to 0-255 range
    normalized = np.clip((temp_array - temp_min) / (temp_max - temp_min), 0, 1)
    gray = (normalized * 255).astype(np.uint8)

    if palette == "gray" or COLORMAPS.get(palette, -1) == -1:
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    # Apply custom ironbow colormap (FLIR's signature palette)
    if palette == "ironbow":
        return apply_ironbow(gray)

    colormap_id = COLORMAPS.get(palette, 4)  # Default to rainbow
    return cv2.applyColorMap(gray, colormap_id)


def apply_ironbow(gray: np.ndarray) -> np.ndarray:
    """
    Custom ironbow colormap matching FLIR's thermal palette.
    Transitions: black → blue → purple → red → orange → yellow → white
    """
    # Build a 256x1x3 lookup table for each channel separately
    lut_b = np.zeros(256, dtype=np.uint8)
    lut_g = np.zeros(256, dtype=np.uint8)
    lut_r = np.zeros(256, dtype=np.uint8)

    # Define color stops: (position 0-255, B, G, R)
    stops = [
        (0,   0,   0,   0),     # Black
        (32,  128, 0,   0),     # Dark blue
        (64,  200, 0,   50),    # Blue-purple
        (96,  180, 0,   120),   # Purple
        (128, 80,  0,   200),   # Red-purple
        (160, 0,   20,  240),   # Red
        (192, 0,   100, 255),   # Orange
        (224, 0,   200, 255),   # Yellow
        (255, 200, 255, 255),   # White-hot
    ]

    for i in range(len(stops) - 1):
        pos1, b1, g1, r1 = stops[i]
        pos2, b2, g2, r2 = stops[i + 1]
        for p in range(pos1, min(pos2 + 1, 256)):
            t = (p - pos1) / max(1, pos2 - pos1)
            lut_b[p] = int(b1 + t * (b2 - b1))
            lut_g[p] = int(g1 + t * (g2 - g1))
            lut_r[p] = int(r1 + t * (r2 - r1))

    # Apply LUT per channel
    b = cv2.LUT(gray, lut_b)
    g = cv2.LUT(gray, lut_g)
    r = cv2.LUT(gray, lut_r)

    return cv2.merge([b, g, r])


def extract_region_stats(temp_array: np.ndarray,
                          bounds: dict) -> dict:
    """
    Calculate temperature statistics for a normalized region of interest.

    bounds: { x: 0-1, y: 0-1, w: 0-1, h: 0-1 } (normalized coordinates)

    Returns: { min, max, avg, std, median }
    """
    h, w = temp_array.shape[:2]
    x1 = int(bounds['x'] * w)
    y1 = int(bounds['y'] * h)
    x2 = int((bounds['x'] + bounds['w']) * w)
    y2 = int((bounds['y'] + bounds['h']) * h)

    # Clamp to array bounds
    x1, x2 = max(0, x1), min(w, x2)
    y1, y2 = max(0, y1), min(h, y2)

    region = temp_array[y1:y2, x1:x2]

    if region.size == 0:
        return {'min': 0, 'max': 0, 'avg': 0, 'std': 0, 'median': 0}

    return {
        'min': round(float(np.min(region)), 2),
        'max': round(float(np.max(region)), 2),
        'avg': round(float(np.mean(region)), 2),
        'std': round(float(np.std(region)), 2),
        'median': round(float(np.median(region)), 2),
    }


def colorized_to_jpeg(colorized_bgr: np.ndarray, quality: int = JPEG_QUALITY) -> bytes:
    """Convert colorized BGR image to JPEG bytes."""
    success, buffer = cv2.imencode('.jpg', colorized_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise RuntimeError("Failed to encode JPEG")
    return buffer.tobytes()


def generate_thumbnail(colorized_bgr: np.ndarray, size: tuple = THUMBNAIL_SIZE) -> bytes:
    """Generate a small thumbnail from a colorized image."""
    thumb = cv2.resize(colorized_bgr, size, interpolation=cv2.INTER_AREA)
    success, buffer = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not success:
        raise RuntimeError("Failed to encode thumbnail")
    return buffer.tobytes()


def save_radiometric_tiff(temp_array: np.ndarray, path: str):
    """Save temperature array as 32-bit float TIFF for full precision."""
    # Convert to 32-bit float for TIFF storage
    temp_32f = temp_array.astype(np.float32)
    cv2.imwrite(path, temp_32f)


def load_radiometric_tiff(path: str) -> np.ndarray:
    """Load a saved radiometric TIFF and return temperature array."""
    temp_array = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if temp_array is None:
        raise FileNotFoundError(f"Could not load TIFF: {path}")
    return temp_array.astype(np.float64)


def add_temperature_scale(colorized_bgr: np.ndarray,
                           temp_min: float = TEMP_RANGE_MIN,
                           temp_max: float = TEMP_RANGE_MAX,
                           palette: str = DEFAULT_PALETTE) -> np.ndarray:
    """
    Add a temperature color scale bar on the right side of the image.
    Returns a new image with the scale bar appended.
    """
    h, w = colorized_bgr.shape[:2]
    bar_w = 40
    padding = 8
    total_w = w + bar_w + padding * 2

    # Create output image
    output = np.zeros((h, total_w, 3), dtype=np.uint8)
    output[:, :w] = colorized_bgr

    # Generate gradient for scale bar
    gradient = np.linspace(255, 0, h).astype(np.uint8).reshape(h, 1)
    gradient_bar = np.repeat(gradient, bar_w, axis=1)

    if palette == "ironbow":
        colored_bar = apply_ironbow(gradient_bar)
    elif palette == "gray":
        colored_bar = cv2.cvtColor(gradient_bar, cv2.COLOR_GRAY2BGR)
    else:
        colormap_id = COLORMAPS.get(palette, 4)
        colored_bar = cv2.applyColorMap(gradient_bar, colormap_id)

    output[:, w + padding:w + padding + bar_w] = colored_bar

    # Add temperature labels
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.35
    color = (200, 200, 200)
    thickness = 1

    labels = [
        (f"{temp_max:.0f}C", 15),
        (f"{(temp_max + temp_min) / 2:.0f}C", h // 2),
        (f"{temp_min:.0f}C", h - 10),
    ]

    for text, y_pos in labels:
        text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
        x_pos = w + padding + bar_w + 3
        if x_pos + text_size[0] <= total_w:
            cv2.putText(output, text, (x_pos, y_pos), font, font_scale, color, thickness)

    return output


def generate_simulated_thermal(width: int = OUTPUT_WIDTH,
                                 height: int = OUTPUT_HEIGHT,
                                 body_temp: float = 36.5,
                                 variation: float = 2.0) -> np.ndarray:
    """
    Generate a simulated thermal image for development/testing.
    Creates a human-body-like temperature distribution.
    """
    # Base temperature field with slight gradient
    temp = np.full((height, width), body_temp - 1.0)

    # Add body region (warmer in center)
    center_x, center_y = width // 2, height // 2
    y_coords, x_coords = np.ogrid[:height, :width]
    dist = np.sqrt(((x_coords - center_x) / (width * 0.3)) ** 2 +
                   ((y_coords - center_y) / (height * 0.4)) ** 2)
    body_mask = dist < 1.0
    temp[body_mask] = body_temp + np.random.normal(0, variation * 0.3, np.sum(body_mask))

    # Add some hot spots
    for _ in range(3):
        hx = np.random.randint(width * 0.2, width * 0.8)
        hy = np.random.randint(height * 0.2, height * 0.8)
        hr = np.random.randint(15, 40)
        hdist = np.sqrt((x_coords - hx) ** 2 + (y_coords - hy) ** 2)
        hotspot = hdist < hr
        temp[hotspot] += np.random.uniform(0.5, 2.5)

    # Add noise
    temp += np.random.normal(0, 0.2, (height, width))

    return temp
