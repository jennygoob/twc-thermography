#!/bin/bash
# TWC Thermography — Camera Service Launcher
# Run this on the clinic workstation before opening the web app

cd "$(dirname "$0")"

echo "=========================================="
echo "  TWC Thermography — Camera Service"
echo "=========================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required but not installed."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "Starting camera service on http://localhost:5050"
echo "Press Ctrl+C to stop"
echo ""

python3 camera_server.py
