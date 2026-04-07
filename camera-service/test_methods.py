"""Discover LVCam methods from type library"""
import comtypes.client
import comtypes
import ctypes

ocx = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
mod = comtypes.client.GetModule(ocx)

# Get the _DLVCam interface
DLVCam = mod._DLVCam
print("=== _DLVCam Interface Methods ===")
print(f"IID: {DLVCam._iid_}")

if hasattr(DLVCam, "_disp_methods_"):
    for i, m in enumerate(DLVCam._disp_methods_):
        print(f"  {i}: {m}")

if hasattr(DLVCam, "_methods_"):
    for i, m in enumerate(DLVCam._methods_):
        print(f"  {i}: {m}")

# Try to get method names from the generated module
print()
print("=== Generated module file ===")
import inspect
src = inspect.getfile(mod)
print(f"Module file: {src}")

# Read the generated file to find method definitions
print()
print("=== Reading generated comtypes module ===")
try:
    with open(src, "r") as f:
        content = f.read()

    # Find all method/property definitions
    for line in content.split("\n"):
        line = line.strip()
        if any(kw in line for kw in ["DISPMETHOD", "DISPPROPERTY", "def ", "COMMETHOD"]):
            print(f"  {line[:120]}")
except Exception as e:
    print(f"Error reading module: {e}")

# Also try creating via IRView ProgID which IS registered
print()
print("=== Try IRView Control ===")
try:
    irview = comtypes.client.CreateObject("IRVIEW.IRViewCtrl.1")
    print(f"IRView created: {irview}")
    print(f"Dir: {[x for x in dir(irview) if not x.startswith('__')]}")
except Exception as e:
    print(f"IRView error: {e}")

print("\nDone.")
