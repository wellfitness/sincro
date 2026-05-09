import ctypes
import ctypes.wintypes
import time

JOYERR_NOERROR = 0

class JOYINFOEX(ctypes.Structure):
    _fields_ = [
        ("dwSize",    ctypes.wintypes.DWORD),
        ("dwFlags",   ctypes.wintypes.DWORD),
        ("dwXpos",    ctypes.wintypes.DWORD),
        ("dwYpos",    ctypes.wintypes.DWORD),
        ("dwZpos",    ctypes.wintypes.DWORD),
        ("dwRpos",    ctypes.wintypes.DWORD),
        ("dwUpos",    ctypes.wintypes.DWORD),
        ("dwVpos",    ctypes.wintypes.DWORD),
        ("dwButtons", ctypes.wintypes.DWORD),
        ("dwButtonNumber", ctypes.wintypes.DWORD),
        ("dwPOV",     ctypes.wintypes.DWORD),
        ("dwReserved1", ctypes.wintypes.DWORD),
        ("dwReserved2", ctypes.wintypes.DWORD),
    ]

JOY_RETURNALL = 0xFF

winmm = ctypes.windll.winmm

info = JOYINFOEX()
info.dwSize = ctypes.sizeof(JOYINFOEX)
info.dwFlags = JOY_RETURNALL

prev = None
print("Mostrando estado crudo de la alfombra (20s) - pisa cualquier panel:")
print(f"{'Tiempo':>6} | {'Botones':>10} | {'X':>6} | {'Y':>6} | {'Z':>6} | {'POV':>6}")
print("-" * 60)

deadline = time.time() + 20
while time.time() < deadline:
    info.dwFlags = JOY_RETURNALL
    ret = winmm.joyGetPosEx(0, ctypes.byref(info))
    if ret == JOYERR_NOERROR:
        state = (info.dwButtons, info.dwXpos, info.dwYpos, info.dwZpos, info.dwPOV)
        if state != prev:
            t = round(time.time() % 1000, 2)
            print(f"{t:>6.2f} | {info.dwButtons:>10} | {info.dwXpos:>6} | {info.dwYpos:>6} | {info.dwZpos:>6} | {info.dwPOV:>6}")
            prev = state
    time.sleep(0.02)

print("-" * 60)
print("Fin del test.")
