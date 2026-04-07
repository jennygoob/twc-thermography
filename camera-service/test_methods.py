"""Discover all methods on the LVCam COM object"""
import comtypes.client

ocx = r"C:\Program Files (x86)\FLIR Systems\ThermoVision SDK Runtime\CamCtrl.ocx"
mod = comtypes.client.GetModule(ocx)
cam = comtypes.CoCreateInstance(mod.LVCam._reg_clsid_)

print("=== COM Interfaces ===")
for iface in cam._com_interfaces_:
    print(f"\nInterface: {iface.__name__}")
    if hasattr(iface, "_methods_"):
        for method in iface._methods_:
            print(f"  Method: {method[0]}")
    if hasattr(iface, "_disp_methods_"):
        for method in iface._disp_methods_:
            print(f"  DispMethod: {method[0]}")

print("\n=== All attributes ===")
for name in sorted(dir(cam)):
    if not name.startswith("__"):
        try:
            val = getattr(cam, name)
            print(f"  {name}: {type(val).__name__} = {val}")
        except Exception as e:
            print(f"  {name}: ERROR - {e}")

print("\n=== Type info ===")
try:
    ti = cam.GetTypeInfo(0, 0)
    print(f"TypeInfo: {ti}")
    ta = ti.GetTypeAttr()
    print(f"  Num funcs: {ta.cFuncs}")
    print(f"  Num vars: {ta.cVars}")
    for i in range(ta.cFuncs):
        fd = ti.GetFuncDesc(i)
        names = ti.GetNames(fd.memid)
        print(f"  Func {i}: {names[0]} (id={fd.memid})")
except Exception as e:
    print(f"TypeInfo error: {e}")

print("\nDone.")
