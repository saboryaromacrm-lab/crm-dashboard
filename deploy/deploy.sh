#!/usr/bin/env bash
#
# DEPLOY DEL DASHBOARD — uso: ./deploy.sh prod | dev
#
# El dashboard NO tiene servicio: es estático. nginx sirve `dist/` directo, así
# que desplegar es compilar y nada más — no hay nada que reiniciar.
#
# El runbook completo del servidor está en el repo de la API:
#   crm-api/deploy/DEPLOY.md
#
set -euo pipefail

ETAPA="${1:-}"
case "$ETAPA" in
  prod) RAMA=main; RAIZ=/srv/crm/prod ;;
  dev)  RAMA=dev;  RAIZ=/srv/crm/dev  ;;
  *) echo "uso: $0 prod|dev" >&2; exit 2 ;;
esac

APP="$RAIZ/crm-dashboard"
cd "$APP"

# ---------------------------------------------------------------------------
# LA TRAMPA DE VITE, Y POR QUÉ ACÁ NO HAY .env
#
# Vite HORNEA las variables en el bundle al compilar. Si se define
# VITE_API_BASE_URL con una URL absoluta, esa URL queda escrita dentro del
# JavaScript: el dist/ de dev y el de producción pasan a ser artefactos
# distintos, y un build de dev promovido a producción apuntaría a la API
# equivocada. Con datos reales.
#
# El default de src/core/config/env.js es RELATIVO ('/api'), y nginx publica la
# API en /api del mismo dominio. Resultado: el MISMO dist/ sirve para las dos
# etapas, quien decide qué API contesta es el servidor, y de paso no hay CORS
# porque no hay cruce de orígenes.
#
# Por eso este script no crea ni lee un .env, y por eso aborta si encuentra uno
# con una URL absoluta: sería un pie de bala silencioso.
# ---------------------------------------------------------------------------
if [ -f .env ] && grep -qE '^\s*VITE_API_BASE_URL\s*=\s*https?://' .env; then
  echo "!! $APP/.env define VITE_API_BASE_URL con una URL absoluta." >&2
  echo "!! Eso queda horneado en el bundle y ata este build a un dominio." >&2
  echo "!! Borrá esa línea: el default relativo '/api' es lo que corresponde acá." >&2
  exit 1
fi

ANTERIOR="$(git rev-parse HEAD)"
echo "== $ETAPA · rama $RAMA · venía en ${ANTERIOR:0:8}"

git fetch --prune origin
git checkout "$RAMA"
git reset --hard "origin/$RAMA"
echo "== ahora en $(git rev-parse --short HEAD)"

npm ci

# Se compila a un lado y se cambia de golpe. Si `vite build` se cae a mitad de
# camino escribiendo sobre dist/, el dashboard queda roto en vivo; así, el dist/
# viejo sigue sirviendo hasta que el nuevo está completo.
rm -rf dist.nuevo
npx vite build --outDir dist.nuevo

[ -f dist.nuevo/index.html ] || { echo "!! El build no dejó index.html" >&2; exit 1; }

rm -rf dist.anterior
[ -d dist ] && mv dist dist.anterior
mv dist.nuevo dist

echo "== OK: $ETAPA compilado ($(du -sh dist | cut -f1)). El dist/ anterior quedó en dist.anterior/"
