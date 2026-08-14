# syntax=docker/dockerfile:1

################################################################################
# CRM DASHBOARD — imagen de producción
# ==============================================================================
# El dashboard es una SPA de Vite: el resultado del build son archivos estáticos,
# así que la imagen final es nginx con esos archivos adentro. No hay Node
# corriendo en producción.
#
# LO QUE HAY QUE ENTENDER ANTES DE TOCAR ESTO: las variables `VITE_*` se
# HORNEAN EN EL BUILD. No son configuración del contenedor — quedan escritas
# dentro del JavaScript que baja el navegador. Cambiar a dónde apunta la API no
# se hace reiniciando: se hace reconstruyendo la imagen.
#
# Por eso el default de `apiBaseUrl` es `/api` (ver src/core/config/env.js) y
# conviene dejarlo así: con el dashboard y la API en el MISMO dominio no hay
# nada que hornear, no hay CORS, y el token de sesión no viaja entre orígenes.
################################################################################

# ---------------------------- 1) Construcción -------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Las dependencias primero y solas: mientras `package*.json` no cambie, Docker
# reusa esta capa y el deploy no vuelve a bajar node_modules entero.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# A DÓNDE LE PIDE LA API ESTE BUILD.
#
# Se pasa como argumento de build (en Dokploy: Build Args) porque las `VITE_*`
# se resuelven al COMPILAR, no al arrancar: quedan escritas adentro del
# JavaScript. Cambiar esto no es reiniciar el contenedor, es reconstruirlo.
#
# Sin pasar nada, el default de `src/core/config/env.js` es `/api` relativo, que
# es lo correcto cuando la API vive en el MISMO dominio que el dashboard.
# Cuando la API tiene subdominio propio hay que pasar la URL absoluta:
#
#   VITE_API_BASE_URL=https://api.saboryaroma.com/api
#
# Ojo con el `/api` del final: es el prefijo con el que la API publica TODAS sus
# rutas, y no se deduce del subdominio.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ------------------------------ 2) Ejecución --------------------------------
FROM nginx:1.27-alpine AS runner

# La configuración propia reemplaza la default de la imagen. Acá vive el
# fallback de la SPA, que es lo que evita el 404 al recargar una pantalla.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# LOS SOURCE MAPS NO VIAJAN, y son 7,9 MB de los 11 que pesa el build.
#
# Un `.map` es el código fuente entero del dashboard en texto legible: nombres
# de variables, comentarios y la estructura de cada módulo. Publicarlo le
# entrega a cualquiera que abra el sitio el mapa completo de las pantallas,
# incluidas las claves de permiso que se piden en cada una. El navegador de un
# usuario normal ni los pide —solo se bajan con las herramientas de desarrollo
# abiertas—, así que sacarlos no le cambia nada a nadie salvo el peso.
#
# Se borran ACÁ y no apagando `sourcemap` en vite.config.js a propósito: el
# build local los sigue generando, que es donde sirven para depurar.
RUN find /usr/share/nginx/html -name '*.map' -delete

# 8080 y no 80: por encima de 1024 el proceso no necesita privilegios de root
# para escuchar.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
