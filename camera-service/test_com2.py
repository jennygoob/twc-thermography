"""Test ThermoVision SDK - direct COM object creation from type library"""
import sys
import os

print("=== Method 1: Create from GetModule typelib ===")
try:
    import comtypes
    import comtypes.client

    ocx_path = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
    print(f"Loading typelib from: {ocx_path}")
    mod = comtypes.client.GetModule(ocx_path)
    print(f"Module: {mod}")
    print(f"Module contents:")
    for name in dir(mod):
        if not name.startswith("_"):
            obj = getattr(mod, name)
            print(f"  {name}: {type(obj).__name__} = {obj}")

    # Try to find the CLSID for LVCam or similar
    print()
    print("Looking for CoClass objects...")
    for name in dir(mod):
        obj = getattr(mod, name)
        if hasattr(obj, "_reg_clsid_"):
            print(f"  CoClass: {name}, CLSID: {obj._reg_clsid_}")
            try:
                instance = comtypes.CoCreateInstance(obj._reg_clsid_)
                print(f"    CREATED: {instance}")
                print(f"    Methods: {dir(instance)}")
            except Exception as e:
                print(f"    Create failed: {e}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print()
print("=== Method 2: Try DLL directly ===")
try:
    import ctypes
    sdk_path = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime"

    dlls_to_try = [
        "CyCamLib.dll",
        "CyGigeVisionLib.dll",
        "CyDisp.dll",
        "CyEngineLib.dll",
    ]

    for dll_name in dlls_to_try:
        dll_path = os.path.join(sdk_path, dll_name)
        if os.path.exists(dll_path):
            try:
                lib = ctypes.CDLL(dll_path)
                print(f"  Loaded: {dll_name}")
            except Exception as e:
                try:
                    lib = ctypes.WinDLL(dll_path)
                    print(f"  Loaded (WinDLL): {dll_name}")
                except Exception as e2:
                    print(f"  Failed: {dll_name} -> {e2}")
        else:
            print(f"  Not found: {dll_name}")

except Exception as e:
    print(f"Error: {e}")

print()
print("=== Method 3: Search Windows Registry for FLIR COM objects ===")
try:
    import winreg

    clsid_key = winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "CLSID")
    count = 0
    found = []

    try:
        i = 0
        while True:
            try:
                subkey_name = winreg.EnumKey(clsid_key, i)
                try:
                    subkey = winreg.OpenKey(clsid_key, subkey_name)
                    try:
                        val = winreg.QueryValue(subkey, None)
                        if val and ("FLIR" in val.upper() or "THERMO" in val.upper() or "IRVIEW" in val.upper() or "CAMCTRL" in val.upper() or "CYCAM" in val.upper() or "LVCAM" in val.upper()):
                            found.append((subkey_name, val))
                            print(f"  {subkey_name}: {val}")
                    except:
                        pass
                    winreg.CloseKey(subkey)
                except:
                    pass
                i += 1
            except OSError:
                break
    except:
        pass

    winreg.CloseKey(clsid_key)

    if not found:
        print("  No FLIR/ThermoVision COM objects found in registry")
    else:
        print(f"  Found {len(found)} objects")

except Exception as e:
    print(f"Registry search error: {e}")

print()
print("Done.")
