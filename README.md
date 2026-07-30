# CRM Dashboard

Base de un **CRM/ERP modular para comercios**, construida como un *framework*
escalable. El objetivo del diseño es simple de enunciar y exigente de cumplir:
**agregar módulos nuevos sin tocar (ni romper) el núcleo ni los módulos
existentes**.

Stack: **React + Vite**, **React Router** (data router), **Material UI** solo
para componentes, **CSS puro / CSS Modules** para estilos, **JavaScript** con la
estructura preparada para migrar a **TypeScript**.

---

## Requisitos

- Node.js `>= 18.18`
- npm `>= 9`

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ajustá las variables VITE_*
npm run dev               # entorno de desarrollo (http://localhost:3000)
npm run build             # build de producción -> dist/
npm run preview           # sirve el build para verificarlo
npm run lint              # ESLint
```

> Usuario demo (auth simulada): cualquier envío del formulario de login entra.
> La lógica real se conecta únicamente en `src/core/auth/auth.service.js`.

## Estructura (resumen)

```
src/
├── core/       # Núcleo del framework: layout, router, navegación, temas,
│               # auth, permisos, hooks y servicios compartidos, registro de módulos.
├── modules/    # Módulos de negocio, cada uno 100% autocontenido.
│   └── dashboard/
├── shared/     # Componentes/utilidades reutilizables, sin lógica de negocio.
├── assets/     # Imágenes, íconos, fuentes.
└── styles/     # Reset, design tokens (variables CSS) y estilos globales.
```

## ¿Cómo agrego un módulo?

1. Creá `src/modules/<mi-modulo>/` copiando la estructura de `dashboard/`.
2. Exportá su manifiesto con `defineModule({...})` en `index.js`.
3. Registralo agregándolo al array de `src/modules/index.js`.

Las rutas y la navegación se generan **solos** a partir del manifiesto. No se
edita el núcleo. La guía completa está en **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Documentación

La explicación detallada de la arquitectura, el flujo de escalabilidad, el
sistema de registro de módulos, las convenciones de nombres y las
recomendaciones para llevarlo a plataforma empresarial están en
**[ARCHITECTURE.md](./ARCHITECTURE.md)**.
