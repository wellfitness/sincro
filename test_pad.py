import ctypes
import ctypes.wintypes
import time

JOYERR_NOERROR = 0

class JOYINFO(ctypes.Structure):
    _fields_ = [
        ("wXpos", ctypes.wintypes.UINT),
        ("wYpos", ctypes.wintypes.UINT),
        ("wZpos", ctypes.wintypes.UINT),
        ("wButtons", ctypes.wintypes.UINT),
    ]

class JOYCAPS(ctypes.Structure):
    _fields_ = [
        ("wMid", ctypes.wintypes.WORD),
        ("wPid", ctypes.wintypes.WORD),
        ("szPname", ctypes.c_char * 32),
        ("wXmin", ctypes.wintypes.UINT),
        ("wXmax", ctypes.wintypes.UINT),
        ("wYmin", ctypes.wintypes.UINT),
        ("wYmax", ctypes.wintypes.UINT),
        ("wZmin", ctypes.wintypes.UINT),
        ("wZmax", ctypes.wintypes.UINT),
        ("wNumButtons", ctypes.wintypes.UINT),
        ("wPeriodMin", ctypes.wintypes.UINT),
        ("wPeriodMax", ctypes.wintypes.UINT),
    ]

winmm = ctypes.windll.winmm

print("=== Deteccion de joysticks ===")
found_id = -1
for joy_id in range(16):
    caps = JOYCAPS()
    ret = winmm.joyGetDevCapsA(joy_id, ctypes.byref(caps), ctypes.sizeof(caps))
    if ret == JOYERR_NOERROR:
        name = caps.szPname.decode("latin-1", errors="replace")
        print(f"  Joystick {joy_id}: '{name}' | Botones: {caps.wNumButtons}")
        if found_id == -1:
            found_id = joy_id

if found_id == -1:
    # Fallback: try joyGetPos to find any responding device
    info = JOYINFO()
    for joy_id in range(4):
        if winmm.joyGetPos(joy_id, ctypes.byref(info)) == JOYERR_NOERROR:
            print(f"  Dispositivo responde en slot {joy_id} (sin nombre via caps)")
            found_id = joy_id
            break

if found_id == -1:
    print("  ERROR: No se encontro ningun joystick.")
    exit(1)

print()
print(f"Usando joystick slot {found_id}")
print("Pisa los paneles! (20 segundos)")
print("-" * 50)

button_names = {
    0: "Arriba   [B1]",
    1: "Abajo    [B2]",
    2: "Izquierda[B3]",
    3: "Derecha  [B4]",
    6: "UpLeft   [B7]",
    7: "UpRight  [B8]",
    8: "Start    [B9]",
    9: "Back     [B10]",
}

info = JOYINFO()
prev_buttons = -1
deadline = time.time() + 20
any_input = False

while time.time() < deadline:
    remaining = int(deadline - time.time())
    ret = winmm.joyGetPos(found_id, ctypes.byref(info))
    if ret == JOYERR_NOERROR:
        buttons = info.wButtons
        if buttons != prev_buttons:
            if buttons == 0:
                if prev_buttons > 0:
                    print(f"  [suelto] ({remaining}s)")
            else:
                pressed = []
                for bit in range(16):
                    if buttons & (1 << bit):
                        pressed.append(button_names.get(bit, f"B{bit+1}"))
                print(f"  PISADO -> {' + '.join(pressed)}  ({remaining}s)")
                any_input = True
            prev_buttons = buttons
    time.sleep(0.02)

print("-" * 50)
if any_input:
    print("RESULTADO: La alfombra responde correctamente!")
else:
    print("RESULTADO: No se detecto input (nadie piso la alfombra).")
