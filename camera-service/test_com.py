"""Test ThermoVision SDK COM objects"""
import sys
import os

print("Python version:", sys.version)
print("Testing COM access to ThermoVision SDK...")
print()

# Check if the OCX files exist
sdk_path = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime"
driver_path = r"C:\Program Files (x86)\FLIR Systems\FLIR Device Drivers"

print("=== SDK Files ===")
if os.path.exists(sdk_path):
    for f in os.listdir(sdk_path):
        if f.endswith((".ocx", ".dll", ".ax")):
            print(f"  {f}")
else:
    print(f"  SDK path not found: {sdk_path}")

print()
print("=== Driver Files ===")
if os.path.exists(driver_path):
    for f in os.listdir(driver_path):
        if f.endswith((".ocx", ".dll", ".ax")):
            print(f"  {f}")
else:
    print(f"  Driver path not found: {driver_path}")

print()
print("=== Trying COM objects ===")

try:
    import comtypes.client
    print("comtypes loaded OK")
except Exception as e:
    print(f"comtypes failed: {e}")
    sys.exit(1)

# Try loading the OCX
ocx_file = os.path.join(sdk_path, "CamCtrl.ocx")
if os.path.exists(ocx_file):
    print(f"Found: {ocx_file}")
    try:
        t = comtypes.client.GetModule(ocx_file)
        print(f"GetModule OK: {t}")
        print(f"Contents: {dir(t)}")
    except Exception as e:
        print(f"GetModule failed: {e}")
else:
    print(f"Not found: {ocx_file}")

# Try creating COM objects by ProgID
print()
print("=== Trying ProgIDs ===")
progids = [
    "ThermoVision.CamCtrl",
    "ThermoVision.CamCtrl.1",
    "CYCAMLIB.CyCamCtrl",
    "CYCAMLIB.CyCamCtrl.1",
    "FLIRSystems.CamCtrl",
    "IRView.IRViewCtrl",
    "IRView.IRViewCtrl.1",
    "CamCtrl.CamCtrl",
    "CamCtrl.CamCtrl.1",
]

for pid in progids:
    try:
        obj = comtypes.client.CreateObject(pid)
        print(f"  SUCCESS: {pid} -> {obj}")
        print(f"    Methods: {dir(obj)}")
    except Exception as e:
        err = str(e).split("\n")[0][:80]
        print(f"  FAILED:  {pid} -> {err}")

# Try win32com as alternative
print()
print("=== Trying win32com ===")
try:
    import win32com.client
    print("win32com loaded OK")
    for pid in progids:
        try:
            obj = win32com.client.Dispatch(pid)
            print(f"  SUCCESS: {pid} -> {obj}")
        except Exception as e:
            err = str(e).split("\n")[0][:80]
            print(f"  FAILED:  {pid} -> {err}")
except Exception as e:
    print(f"win32com failed: {e}")

print()
print("Done.")
