import ctypes
import ctypes.wintypes
import time

JOYERR_NOERROR = 0
JOY_RETURNALL = 0xFF

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

winmm = ctypes.windll.winmm

button_names = {
    0: "ARRIBA   (B1)",
    1: "ABAJO    (B2)",
    2: "IZQUIERDA(B3)",
    3: "DERECHA  (B4)",
    4: "B5",
    5: "B6",
    6: "UP-LEFT  (B7)",
    7: "UP-RIGHT (B8)",
    8: "START    (B9)",
    9: "BACK     (B10)",
}

info = JOYINFOEX()
info.dwSize = ctypes.sizeof(JOYINFOEX)

DURATION = 30
print(f"Tienes {DURATION}s para pisar TODOS los paneles (en cualquier orden)")
print("Paneles a probar: ARRIBA, ABAJO, IZQUIERDA, DERECHA, START, BACK")
print()

seen_bits = set()
prev_buttons = 0
deadline = time.time() + DURATION

while time.time() < deadline:
    info.dwFlags = JOY_RETURNALL
    if winmm.joyGetPosEx(0, ctypes.byref(info)) == JOYERR_NOERROR:
        buttons = info.dwButtons
        if buttons != prev_buttons and buttons != 0:
            new_bits = []
            for bit in range(16):
                if buttons & (1 << bit):
                    if bit not in seen_bits:
                        seen_bits.add(bit)
                        new_bits.append(bit)
            if new_bits:
                for b in new_bits:
                    name = button_names.get(b, f"B{b+1}")
                    print(f"  [PRIMERA VEZ] {name}  (X={info.dwXpos} Y={info.dwYpos})")
        prev_buttons = buttons
    time.sleep(0.02)

print()
print("=" * 50)
print("RESUMEN: paneles que registraron input")
print("=" * 50)
all_panels = [0, 1, 2, 3, 8, 9]
for b in all_panels:
    status = "OK" if b in seen_bits else "no detectado"
    print(f"  {button_names[b]:<18} -> {status}")
print()
extras = [b for b in seen_bits if b not in all_panels]
if extras:
    print("Bits adicionales detectados:")
    for b in extras:
        print(f"  bit {b} (B{b+1}) -> {button_names.get(b, '?')}")
