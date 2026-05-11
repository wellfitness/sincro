#!/bin/bash
# Deploy Sincro a Hostinger via FTP.
# Sube TODO el shell estático (HTML + sw + manifest + iconos + imágenes +
# stepmania-web/) a public_html del subdominio play.movimientofuncional.app.
#
# Estrategia: git como fuente de verdad.
#   - Enumeramos con `git ls-files` (no se filtran archivos sin trackear).
#   - Excluimos sólo categorías claramente NO-prod (docs/.md, scripts dev,
#     fuentes .png originales 7 MB, tests, dirs de dev como design-system/,
#     stepmania-5_1-new/, .claude/, .husky/, etc.).
#   - Resultado: todo asset versionado y necesario para producción se sube
#     automáticamente. Añades una imagen nueva, la commiteas, y sube sola.
#
# Patron base mantenido (mismo que cadencia y KinesisLab): bash + curl,
# cero deps, lee credenciales de .env.local (gitignored).

set -e

# Permite invocar el script desde cualquier directorio. cwd queda en la raíz.
cd "$(dirname "$0")/.."

# Cargar variables FTP
if [ ! -f ".env.local" ]; then
  echo "ERROR: No existe .env.local en la raíz del proyecto."
  echo "Debe contener: FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR"
  exit 1
fi
source .env.local

if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
  echo "ERROR: Faltan credenciales FTP en .env.local"
  echo "Necesitas: FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR"
  exit 1
fi

BASE_URL="ftp://${FTP_HOST}${FTP_REMOTE_DIR}"
CURL_AUTH="--user ${FTP_USER}:${FTP_PASS}"
# --ftp-create-dirs : crea carpetas remotas al subir el primer archivo
# --ssl-allow-beast : workaround para algunos servidores FTPS antiguos
# -k                : ignora errores de certificado (Hostinger usa cert válido pero
#                     SChannel en Windows hace OCSP-strict por defecto)
CURL_OPTS="--ftp-create-dirs --ssl-allow-beast -k"
COUNTER=0
ERRORS=0
FAILED_FILES=()

upload_file() {
  local local_path="$1"
  local remote_path="$2"

  if [ ! -f "$local_path" ]; then
    ERRORS=$((ERRORS + 1))
    FAILED_FILES+=("$remote_path (no existe en local)")
    echo "  SKIP: $remote_path (no existe en local)"
    return
  fi

  if curl -s -S -T "$local_path" $CURL_AUTH $CURL_OPTS "${BASE_URL}${remote_path}" 2>/dev/null; then
    COUNTER=$((COUNTER + 1))
    echo "  OK: $remote_path"
  else
    ERRORS=$((ERRORS + 1))
    FAILED_FILES+=("$remote_path")
    echo "  FAIL: $remote_path"
  fi
}

# ──────────────────────────────────────────────
# Construir lista de archivos a subir
# ──────────────────────────────────────────────
# Patrones EXCLUIDOS (no van a producción):
#   - Docs/configs locales: *.md, .gitignore, LICENSE, package.json,
#     pnpm-lock.yaml, vitest.config.mjs
#   - Scripts dev: scripts/, *.py
#   - Tests: tests/
#   - Imagen fuente: *.png (las .webp optimizadas SÍ se suben — los .png
#     originales pesan ~7 MB cada uno y no se referencian en HTML)
#   - Dirs ajenos: .claude/, .husky/, design-system/, stepmania-5_1-new/
#
# Si algún día necesitas subir un .md o un .png a producción, ajusta la
# regex aquí abajo — pero piensa dos veces (¿de verdad lo quieren ver los
# crawlers / es seguro?).

# Patterns con `/` matchean prefijo de directorio (sin $); patterns de archivo
# exacto llevan `$`. Bash regex no permite mezclar bien anclas dentro de
# alternativas con un solo `^...$`, así que cada item lleva su propio anchor.
EXCLUDE_REGEX='^(\.gitignore$|\.claude/|\.husky/|design-system/|stepmania-5_1-new/|scripts/|tests/|node_modules/|LICENSE$|README\.md$|CLAUDE\.md$|PLAN.*\.md$|package\.json$|pnpm-lock\.yaml$|vitest\.config\.mjs$)|\.py$|\.png$'

echo "=========================================="
echo "  Deploy Sincro a Hostinger"
echo "=========================================="
echo "Host: $FTP_HOST"
echo "Dir:  $FTP_REMOTE_DIR (relativo al public_html del subdominio)"
echo ""

# Recolectar archivos: todo lo trackeado por git que no matchee el regex de exclusión.
FILES=()
while IFS= read -r f; do
  if [[ ! "$f" =~ $EXCLUDE_REGEX ]]; then
    FILES+=("$f")
  fi
done < <(git ls-files | sort)

TOTAL=${#FILES[@]}
echo "Archivos a subir: $TOTAL"
echo ""

for f in "${FILES[@]}"; do
  upload_file "$f" "$f"
done

echo ""
echo "=========================================="
echo "  Deploy completado"
echo "=========================================="
echo "Subidos: $COUNTER / $TOTAL archivos"
if [ $ERRORS -gt 0 ]; then
  echo "ERRORES: $ERRORS archivos"
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
else
  echo "Errores: 0"
fi
echo ""
echo "URL: https://play.movimientofuncional.app"
echo ""
echo "Recordatorios:"
echo "  - Si tocaste archivos del precache, asegúrate de haber bumpeado"
echo "    CACHE_VERSION en sw.js (regla CLAUDE.md)."
echo "  - Usuarios con PWA instalada verán el cambio en la próxima carga"
echo "    cuando el SW nuevo se active (self.clients.claim() lo fuerza)."
