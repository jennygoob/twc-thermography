"""Discover all methods on the LVCam COM object"""
import comtypes.client
import comtypes

ocx = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
mod = comtypes.client.GetModule(ocx)

print("=== Module classes ===")
for name in dir(mod):
    obj = getattr(mod, name)
    if hasattr(obj, "_reg_clsid_"):
        print(f"  CoClass: {name} CLSID={obj._reg_clsid_}")
    if hasattr(obj, "_iid_"):
        print(f"  Interface: {name} IID={obj._iid_}")
        if hasattr(obj, "_methods_"):
            for m in obj._methods_:
                print(f"    method: {m[0]}")
        if hasattr(obj, "_disp_methods_"):
            for m in obj._disp_methods_:
                print(f"    disp: {m[0]}")

print()
print("=== Try win32com for dynamic dispatch ===")
try:
    import win32com.client
    cam = win32com.client.Dispatch("ThermoVision.CamCtrl")
    print(f"CamCtrl created: {cam}")
except Exception as e:
    print(f"ThermoVision.CamCtrl: {e}")

try:
    import win32com.client
    cam = win32com.client.Dispatch("CYCAMLIB.CyCamCtrl")
    print(f"CyCamCtrl created: {cam}")
except Exception as e:
    print(f"CYCAMLIB.CyCamCtrl: {e}")

print()
print("=== Try creating LVCam with dynamic dispatch ===")
try:
    import win32com.client
    clsid = "{061A628E-04A3-4EA2-B4F9-2E3497888795}"
    cam = win32com.client.Dispatch(clsid)
    print(f"LVCam via dispatch: {cam}")
    print(f"Dir: {dir(cam)}")
except Exception as e:
    print(f"Dispatch failed: {e}")

try:
    cam = win32com.client.gencache.EnsureDispatch(clsid)
    print(f"LVCam via EnsureDispatch: {cam}")
except Exception as e:
    print(f"EnsureDispatch failed: {e}")

print()
print("=== Registry check for LVCam ProgID ===")
try:
    import winreg
    key = winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"CLSID\{061A628E-04A3-4EA2-B4F9-2E3497888795}")
    val = winreg.QueryValue(key, None)
    print(f"CLSID name: {val}")
    try:
        pk = winreg.OpenKey(key, "ProgID")
        pid = winreg.QueryValue(pk, None)
        print(f"ProgID: {pid}")
    except:
        print("No ProgID subkey")
    try:
        pk = winreg.OpenKey(key, "InprocServer32")
        srv = winreg.QueryValue(pk, None)
        print(f"InprocServer32: {srv}")
    except:
        print("No InprocServer32")
    try:
        pk = winreg.OpenKey(key, "LocalServer32")
        srv = winreg.QueryValue(pk, None)
        print(f"LocalServer32: {srv}")
    except:
        print("No LocalServer32")
    winreg.CloseKey(key)
except Exception as e:
    print(f"Registry error: {e}")

print()
print("=== Scan all FLIR CLSIDs for ProgIDs ===")
try:
    import winreg
    flir_clsids = [
        ("{061A628E-04A3-4EA2-B4F9-2E3497888795}", "LVCam"),
        ("{0DD03226-05F4-4E58-A0E5-6DB739606664}", "FLIR IRView"),
        ("{5BCD4A05-C8D9-4391-A0F7-16260748AB16}", "CamCtrl Property"),
        ("{64728585-7366-4943-A021-A2ED6F3D0B02}", "IRView Property"),
        ("{87E59919-685F-4BA4-BC3C-1522D14C7281}", "FLIR RTSP"),
        ("{CCE6316A-04E5-4483-9AFC-FC86E26B93C2}", "FLIRDMFilter"),
    ]
    for clsid, name in flir_clsids:
        try:
            key = winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, f"CLSID\\{clsid}")
            val = winreg.QueryValue(key, None)
            print(f"\n{name} ({clsid}):")
            print(f"  Name: {val}")
            for subkey_name in ["ProgID", "InprocServer32", "LocalServer32", "TypeLib"]:
                try:
                    pk = winreg.OpenKey(key, subkey_name)
                    sv = winreg.QueryValue(pk, None)
                    print(f"  {subkey_name}: {sv}")
                except:
                    pass
            winreg.CloseKey(key)
        except:
            print(f"{name}: not found in registry")
except Exception as e:
    print(f"Error: {e}")

print("\nDone.")
