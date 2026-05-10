# Sincro — Suite rítmica de Movimiento Funcional

Suite de juego rítmico en navegador para alfombra de baile (RedOctane USB Pad VID 1430 / PID 8888 + cualquier mat genérico calibrable) y guitarra Guitar Hero (PS2 vía receptor USB Sony-emulado VID 054C/PID 0268, recalibrable). Marca paraguas: **Sincro** (la suite completa). Compatible con el formato de charts `.ssc/.sm` de StepMania 5 (instalado opcionalmente en `C:\Games\StepMania 5` para desarrollo).

## Archivos

### `index.html`
Landing pública del producto **Sincro**. HTML semántico autocontenido (CSS embedded, sin dependencias del motor de juego). Incluye:
- Hero con copy "Pisa el ritmo, entrena 3 cerebros a la vez" + lluvia animada de flechas DDR + 3 CTAs (Jugar / Crear chart / Probar hardware).
- 3 pilares de beneficios — **Físico** (cardio, equilibrio, prevención caídas, cita BJSM 2025), **Mental** (música activa redes globales), **Cognitivo** (sincronización auditivo-motora, función ejecutiva).
- Sección "Cómo funciona en tu cerebro" con SVG inline de 5 redes neurales animadas (corteza auditiva, ganglios basales, SMA, cerebelo, prefrontal).
- Sección "Y también con guitarra" — bonus track con disclaimer honesto ("la guitarra no es cardio") y 4 mini-pilares específicos (percepción musical, coordinación bimanual, AMS, función ejecutiva).
- Tabla comparativa exergaming vs ejercicio tradicional con SMDs reales del meta-meta-análisis.
- Cards de las 3 herramientas, final CTA y footer con disclaimer médico.
- Open Graph + Twitter Card + JSON-LD `WebApplication` con `name: "Sincro"` apuntando a `play.movimientofuncional.app`.
- Favicon SVG inline (emoji 🎮), skip-link, `prefers-reduced-motion`, ARIA labels en cada section, contraste WCAG AA.
- Branding: `⚡ Sincro` con gradiente turquesa→dorado (Righteous + ABeeZee, paleta MF).
- 8 referencias DOI verificadas (PubMed/Scholar Gateway): Singh 2025 BJSM, Yoong 2024, Chen 2021, Lavigne 2025, Benzing 2019, Gong 2016, Särkämö 2013, Bentley 2022, Pasinski 2016, Zaatar 2023.

### `play.html`
Motor de juego (SPA con pantallas: Menú, Jugar, Crear, Probar hardware, Mis canciones, Calibración, Tutorial, Resultados). Carga módulos clásicos desde `stepmania-web/js/`: `core` → `parser` → `autostepper` → `library` → `backup` → `song-select` → `pad-test` → `calibration` → `game` → `app`. Estilos en `stepmania-web/css/styles.css`.

Funcionalidad end-to-end:
- Parser `.ssc/.sm` con BPMs/STOPS/DELAYS/WARPS, OFFSET, NOTES.
- Motor de timing real (J4–J7) con quantización a 192nds, mines, holds/rolls (HOLD_LIFE 300ms), lifts, fakes, hands.
- 6 modifiers: mirror, left, right, shuffle, hidden, sudden + chartSpeed local (0.5–4x) y scrollSpeed global (0.5–3x).
- Librería en IndexedDB con import individual (.ssc/.sm + audio), import packs SM (carpetas), backup ZIP completo (canciones + scores + ajustes), restore.
- Modos de carriles: 4 (clásico DDR), 6 y 8 con redistribución de notas para alfombras de baile completas.
- Soporte de input: alfombra USB, **guitarra Guitar Hero** (5 trastes + strum + whammy mapeados a carriles), teclado (← ↓ ↑ →).
- Settings persistentes (localStorage): globalOffset, scrollSpeed, timingWindow, NoteSkin PNG personalizado, fondo procedural por título.
- Calibración: pantalla con metrónomo + tap para medir offset real con sugerencia automática.

### `test-pad.html`
Diagnóstico de hardware en el navegador (Gamepad API). Selector inicial **Alfombra | Guitarra**.

**Modo Alfombra (9 pestañas):**
- **Calibrar**: asistente paso a paso para mapear los 10 roles físicos (4 cardinales + 4 diagonales + start/back). El mapping se persiste en `localStorage` con key `mat-mapping`. **Filas clickables** para reasignar un rol individualmente sin rehacer toda la calibración (útil si solo unos paneles están mal). El test usa esta calibración: si un rol no está asignado (`null`), los tests lo auto-skippean.
- **Estadísticas**: pisadas por panel, duración media de cada press, polling rate.
- **Latencia**: test de reflejos por panel calibrado (panel aleatorio → mide ms hasta pisar). Solo prueba paneles asignados; ignora roles `null` (ej: si tu pad no tiene DOWN-LEFT, no se prueba).
- **Saltos**: combos simultáneos definidos por roles (Izq+Der, Arriba+Abajo, UP-LEFT+UP-RIGHT, DOWN-LEFT+DOWN-RIGHT, 4 cardinales). Auto-skip a los 5s si algún rol del combo no está calibrado.
- **Sync de audio**: metrónomo configurable BPM 60-180. Mide offset del usuario y sugiere `Global Offset` para `Preferences.ini`.
- **Stress test**: 10s de pisadas rápidas. Detecta bouncing si intervalo mínimo &lt; 15ms.
- **Ghost inputs**: monitorea 60s sin pisar — si aparece input, hay sensor pegado.
- **Secuencia**: histórico de últimas 50 pisadas con timestamp.
- **Ejes**: lectura cruda de los axes del gamepad.

**Modo Guitarra (11 pestañas):**
- **Calibrar**: asistente paso a paso para mapear los 11 roles físicos (5 trastes, strum ↑/↓, tilt, Star Power, Select, Start). El mapping se persiste en `localStorage` con key `guitar-mapping`. **Filas clickables** para reasignar un rol individualmente. Especialmente útil cuando hay conflictos (ej: receptor PS2→USB chino que mapea Verde a btn[7], que casualmente es el default de strumUp).
- **Estadísticas**: pulsos por traste/strum + duración + polling rate.
- **Trastes (latencia)**: 10 rondas de reflejos por traste. Detecta trastes lentos. Solo prueba trastes asignados.
- **Strum**: 15s alternando ↑↓. Mide ratio up:down (debería ser ~1.0) e intervalo mínimo (bouncing).
- **Whammy**: 15s moviendo la palanca. **Auto-detecta el eje correcto** muestreando todos los ejes del gamepad y eligiendo el de mayor rango de movimiento — evita hardcoding de eje Z (algunos receptores usan Y o R). Guarda el eje detectado en `guitarMapping.whammyAxis`.
- **Chords**: combinaciones simultáneas de trastes (G+R, R+Y, power chord G+R+Y+B, fret+strum…). Detecta ghosting de matriz.
- **Sync, Stress, Ghost, Secuencia, Ejes**: compartidas con modo alfombra.

**Sistema de calibración común a ambos modos:**
- Toast verde "✓ btn[X] → rol" tras cada captura.
- Auto-skip de pasos no aplicables ("Saltar paso").
- Botón "Borrar mapping" vuelve a defaults solo del modo activo.
- Cambiar de modo cancela cualquier calibración en curso y restaura el botón Iniciar.

**Mapping físico alfombra via Gamepad API** — defaults; calibrables (alineados con `padMap` de `game.js`):
- `button[0]` = IZQUIERDA · `button[1]` = ABAJO · `button[2]` = ARRIBA · `button[3]` = DERECHA
- `button[4]` = UP-LEFT · `button[5]` = UP-RIGHT · `button[6]` = DOWN-LEFT · `button[7]` = DOWN-RIGHT
- `button[8]` = START · `button[9]` = BACK
- Cualquier pad con mapping distinto (ImpactDX, Cobalt Flux, mats genéricos chinos, X-Pad…) recalibra los 10 roles desde la pestaña "Calibrar".

**Mapping físico guitarra Guitar Hero PS2 via receptor Sony-emulado (VID 054C/PID 0268)** — default; recalibrable:
- `button[0..4]` = trastes Verde/Rojo/Amarillo/Azul/Naranja
- `button[6]` = strum ↓ · `button[7]` = strum ↑
- `button[8]` = Select · `button[9]` = Start
- `axes[2]` (eje Z) = palanca de whammy
- Tilt y Star Power dependen del modelo — calibrar.

### `autostepper.html`
Generador automático de charts StepMania desde MP3/WAV. Equivalente al `phr00t/AutoStepper` (Java) pero en navegador.

**Pipeline de detección (optimizado para música bailable: techno, dance, pop, rock):**
1. `decodeAudioData` → mono Float32Array
2. **Bass-emphasis** — IIR low-pass 2-polo cascado a ~200 Hz. Aísla el kick + bajo, descarta voces, hi-hats, guitarras distorsionadas. El kick domina el envelope.
3. Energy envelope (ventanas 23ms, hop 5ms) sobre la señal bass-emphasized
4. ODF = log-derivada rectificada del envelope
5. Pico-detección con umbral adaptativo local (75ms window)
6. BPM via autocorrelación de la ODF, **rango 90-180 BPM** (cubre pop/rock 90-130, house 120-130, techno 125-145, DnB 165-180), corrección de octava al mismo rango
7. Offset via correlación de fase
8. **Tap sync manual:** botón "Tap" por canción abre modal; usuario pulsa SPACE/botón al ritmo, mediana de intervalos → BPM. Sobrescribe la detección automática vía `q.bpmOverride`.

**Generación de charts (rejilla interna 192nds para compat SM5):**
- Quantización a 192nds (1 measure = 192 unidades, 1 beat = 48)
- Filtro por resolución elegida (negras=48, corcheas=24, semicorcheas=12)
- Asignación de flechas evitando misma flecha 2 veces seguidas
- Holds/rolls cuando hay gap ≥ 1/2 beat al siguiente paso (probabilidad ajustable)
- Hands (3 paneles simultáneos) solo en Challenge
- Resolución variable por compás (cada compás escoge subdivision válida más pequeña: 4/8/12/16/24/32/48/64/96/192)

**Salida (en ZIP, una carpeta por canción):**
- `<song>.ssc` (formato SM5 nativo, con `#NOTEDATA`, RADARVALUES de 12 valores, CHARTNAME, CHARTSTYLE=Pad, METER, etc.)
- `<song>.sm` (legacy, compatibilidad universal con ITG2/Etterna/3.9)
- `<song>.<ext>` (audio renombrado)

**Presets:**
- 🌿 Suave: sens 2.4, negras, 10% holds, 0% jumps
- ⚡ Normal: sens 1.7, corcheas, 25% holds, 7% jumps (recomendado)
- 🔥 Intenso: sens 1.3, semicorcheas, 50% holds, 18% jumps
- ⚙️ Personalizado: sliders independientes

**5 dificultades generadas por canción:** Beginner, Easy, Medium, Hard, Challenge.

Implementa encoder ZIP propio (modo "store", sin compresión) — sin dependencias externas.

### Scripts Python (`test_pad*.py`, `detectar-guitarra.py`)
Tests vía WinMM `joyGetPosEx` (DirectInput equivalent). Útiles si la Gamepad API del navegador no detecta el dispositivo. Usan solo `ctypes`, sin pygame.

- `test_pad.py`: detección + 20s de input por consola (con nombres de paneles).
- `test_pad_raw.py`: 20s mostrando estado crudo (botones, ejes X/Y/Z, POV).
- `test_pad_all.py`: secuencia 30s para verificar los 6 paneles principales.
- `detectar-guitarra.py`: enumera los 16 slots de joystick de Windows con VID/PID/nombre/nº de botones, identifica heurísticamente cuál es guitarra (8-13 botones + eje Z) y monitoriza inputs durante 30s. Útil para confirmar que el receptor PS2→USB está visible al sistema antes de calibrar en el navegador.

Mapping físico alfombra via WinMM (distinto al del navegador):
- B1=ARRIBA, B2=ABAJO, B3=IZQUIERDA, B4=DERECHA, B7=UP-LEFT, B8=UP-RIGHT, B9=START, B10=BACK

## Cómo usar

Doble click sobre los `.html` los abre en el navegador por defecto. Punto de entrada para usuarios: `index.html` (landing). Punto de entrada para jugar directamente: `play.html`.

Para los Python: `python test_pad.py` desde PowerShell. Requiere Python 3.x estándar (sin paquetes adicionales).

## Estado de StepMania 5

- **Instalado en:** `C:\Games\StepMania 5`
- **Configuración:** `C:\Users\HP\AppData\Roaming\StepMania 5\Save\`
  - `Keymaps.ini`: alfombra mapeada a Joy1 (Up=B1, Down=B2, Left=B3, Right=B4)
  - `Preferences.ini`: `LastSeenInputDevices=...|RedOctane USB Pad|...`, `AutoMapOnJoyChange=1`
- **Carpeta de canciones:** `C:\Games\StepMania 5\Songs\` (los ZIPs del autostepper se descomprimen aquí)

## Despliegue

- **Dominio destino:** `play.movimientofuncional.app` (subdominio del sitio principal de Movimiento Funcional). El antiguo subdominio `stepmania.movimientofuncional.app` fue retirado tras el rebrand a Sincro.
- **Credenciales FTP del host:** en `.env.local` (raíz del proyecto). **Nunca commitear** — el archivo está ignorado por `.gitignore` (regla `.env.*`).
- Para futuros agentes: si necesitas las claves de despliegue, léelas de `.env.local`. No las muevas a archivos versionados.
- **Estructura desplegada:** subir todos los `.html` de la raíz + carpeta `stepmania-web/` (CSS + JS). Los `.py` no se despliegan (solo herramientas locales).

## Pendiente / ideas futuras

- Detección de tempo variable (BPM changes) en autostepper.
- Generación de banner/background art automática en autostepper. Bloqueado por CORS desde navegador — necesitaría proxy local o backend.
- Update mode: re-generar charts conservando BPM/offset que el usuario afinó a mano (leer .ssc existente, reusar `#BPMS`/`#OFFSET`).
- Modo couple/double y edit mode (no replicados desde StepMania nativo).
