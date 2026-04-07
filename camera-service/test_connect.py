"""Try every possible way to connect LVCam to the FLIR A300"""
import comtypes.client
import comtypes
import sys

CAMERA_IP = "169.254.79.43"

ocx = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
mod = comtypes.client.GetModule(ocx)

# Get all method signatures from the type library
print("=== _DLVCam method signatures ===")
DLVCam = mod._DLVCam
if hasattr(DLVCam, "_disp_methods_"):
    for i, m in enumerate(DLVCam._disp_methods_):
        print(f"  {i}: {m}")

print()
print("=== Trying IRView Control (registered, working) ===")
try:
    irview = comtypes.client.CreateObject("IRVIEW.IRViewCtrl.1")
    print(f"IRView created: {irview}")

    # List all methods
    methods = [x for x in dir(irview) if not x.startswith("_")]
    print(f"Methods: {methods}")

    # Try connecting IRView to camera
    for method_name in methods:
        if "connect" in method_name.lower() or "init" in method_name.lower() or "open" in method_name.lower() or "start" in method_name.lower() or "ip" in method_name.lower() or "url" in method_name.lower():
            print(f"  Interesting method: {method_name}")

    # Try Ping
    try:
        result = irview.Ping(CAMERA_IP)
        print(f"  Ping({CAMERA_IP}): {result}")
    except Exception as e:
        print(f"  Ping: {e}")

    # Try SetResolution
    try:
        irview.SetResolution(640, 480)
        print(f"  SetResolution: OK")
    except Exception as e:
        print(f"  SetResolution: {e}")

    # Try Set1612Resolution
    try:
        irview.Set1612Resolution()
        print(f"  Set1612Resolution: OK")
    except Exception as e:
        print(f"  Set1612Resolution: {e}")

    # Try SetURL or similar
    for method_name in methods:
        if method_name.startswith("Set"):
            try:
                func = getattr(irview, method_name)
                print(f"  {method_name}: {func}")
            except:
                pass

except Exception as e:
    print(f"IRView error: {e}")

print()
print("=== Try LVCam with SubmitCamCommand variations ===")
cam = comtypes.CoCreateInstance(mod.LVCam._reg_clsid_)
lvcam = cam.QueryInterface(mod._DLVCam)

# The SDK might need an initialization command first
commands = [
    f"init",
    f"initialize",
    f"open",
    f"open {CAMERA_IP}",
    f"connect {CAMERA_IP}",
    f"connect {CAMERA_IP} 80",
    f"connect {CAMERA_IP} 3956",
    f"ip {CAMERA_IP}",
    f"setip {CAMERA_IP}",
    f"scan",
    f"discover",
    f"enum",
    f"enumerate",
    f"start",
    f"start {CAMERA_IP}",
    f"camera {CAMERA_IP}",
    f"attach {CAMERA_IP}",
    f"link {CAMERA_IP}",
]

for cmd in commands:
    try:
        result = lvcam.SubmitCamCommand(cmd)
        print(f"  SubmitCamCommand('{cmd}'): {result}")
    except Exception as e:
        err = str(e).split("\n")[0][:60]
        print(f"  SubmitCamCommand('{cmd}'): {err}")

print()
print("=== Try DoCameraAction variations ===")
actions = [
    ("init", ""),
    ("init", CAMERA_IP),
    ("open", CAMERA_IP),
    ("connect", CAMERA_IP),
    ("discover", ""),
    ("scan", ""),
    ("start", CAMERA_IP),
    ("attach", CAMERA_IP),
]

for action, param in actions:
    try:
        result = lvcam.DoCameraAction(action, param)
        print(f"  DoCameraAction('{action}', '{param}'): {result}")
    except Exception as e:
        err = str(e).split("\n")[0][:60]
        print(f"  DoCameraAction('{action}', '{param}'): {err}")

print()
print("=== Try SetCameraProperty variations ===")
props = [
    ("IPAddress", CAMERA_IP),
    ("IP", CAMERA_IP),
    ("CameraIP", CAMERA_IP),
    ("URL", f"http://{CAMERA_IP}"),
    ("Address", CAMERA_IP),
    ("Host", CAMERA_IP),
    ("ConnectionType", "GigE"),
    ("ConnectionType", "Ethernet"),
    ("Interface", "GigE"),
]

for prop, val in props:
    try:
        lvcam.SetCameraProperty(prop, val)
        print(f"  SetCameraProperty('{prop}', '{val}'): OK")
    except Exception as e:
        err = str(e).split("\n")[0][:60]
        print(f"  SetCameraProperty('{prop}', '{val}'): {err}")

print("\nDone.")
