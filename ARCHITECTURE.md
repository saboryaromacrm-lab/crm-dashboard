# Arquitectura — CRM Dashboard (framework modular)

Este documento describe el diseño de la base del CRM/ERP: por qué está armado
así, cómo escala y cómo se agregan módulos sin tocar el núcleo. Está pensado
como la referencia viva del proyecto para los próximos años.

Índice:

1. [Principios de diseño](#1-principios-de-diseño)
2. [Estructura completa de carpetas](#2-estructura-completa-de-carpetas)
3. [Explicación de la arquitectura por capas](#3-explicación-de-la-arquitectura-por-capas)
4. [Flujo de escalabilidad](#4-flujo-de-escalabilidad)
5. [Sistema de registro de módulos](#5-sistema-de-registro-de-módulos)
6. [Layout principal](#6-layout-principal)
7. [Configuración de rutas](#7-configuración-de-rutas)
8. [El módulo Dashboard como referencia](#8-el-módulo-dashboard-como-referencia)
9. [Buenas prácticas para agregar módulos](#9-buenas-prácticas-para-agregar-módulos)
10. [Convenciones de nombres](#10-convenciones-de-nombres)
11. [Sistema de temas (claro/oscuro/por comercio)](#11-sistema-de-temas)
12. [Responsive design](#12-responsive-design)
13. [Recomendaciones para una plataforma CRM empresarial](#13-recomendaciones-empresariales)
14. [Camino de migración a TypeScript](#14-migración-a-typescript)

---

## 1. Principios de diseño

La base aplica de forma explícita cinco principios, y cada uno se traduce en una
regla concreta del código:

- **Modular Architecture / Feature-Based Structure.** El código se organiza por
  *funcionalidad de negocio* (módulos), no por tipo técnico de archivo. Todo lo
  que un módulo necesita (páginas, componentes, servicios, hooks, config,
  estilos) vive dentro de su propia carpeta.
- **Separation of Concerns.** Cada archivo tiene una única razón para cambiar.
  Las **vistas** (páginas/componentes) no hacen I/O; los **servicios** hacen I/O
  y no saben de React; los **hooks** orquestan estado; la **configuración** no
  contiene lógica.
- **SOLID**, en particular:
  - *Single Responsibility*: contextos separados (Theme, Auth, Permission, UI),
    un servicio por dominio, un hook por pantalla.
  - *Open/Closed*: el núcleo está **cerrado a modificación** y **abierto a
    extensión** vía el registro de módulos. Se agregan módulos, no se edita el
    núcleo.
  - *Dependency Inversion*: el núcleo depende de una **abstracción** (el
    contrato `defineModule`), no de módulos concretos. Los módulos dependen del
    núcleo, nunca al revés.
- **Clean Architecture.** Las dependencias apuntan hacia adentro: `modules →
  shared → core`. El núcleo no conoce ningún módulo; los detalles (MUI, fetch,
  el backend) están aislados detrás de servicios y del sistema de temas para
  poder reemplazarlos sin propagar cambios.

Regla mental de una línea: **para sumar una funcionalidad, se agrega una carpeta
en `modules/` y una línea en `modules/index.js`. Nada más.**

---

## 2. Estructura completa de carpetas

```
crm-dashboard/
├── index.html
├── package.json
├── vite.config.js               # alias @core, @modules, @shared, @styles…
├── jsconfig.json                # mismos alias para el editor (y base para TS)
├── .env.example                 # variables VITE_* documentadas
├── .eslintrc.cjs
├── README.md
├── ARCHITECTURE.md
└── src/
    ├── main.jsx                 # bootstrap: registerModules() + render
    ├── App.jsx                  # composición: <AppProviders><AppRouter/>
    │
    ├── core/                    # ────────── NÚCLEO DEL FRAMEWORK ──────────
    │   ├── config/
    │   │   ├── env.js           # lectura tipada de import.meta.env
    │   │   └── app.config.js    # configuración global (rutas, api, tema…)
    │   ├── theme/
    │   │   ├── palette.js       # paletas claro/oscuro (espejo de tokens.css)
    │   │   ├── createAppTheme.js# factory de theme MUI (+ overrides por comercio)
    │   │   └── ThemeModeContext.jsx
    │   ├── providers/
    │   │   └── AppProviders.jsx # compone TODOS los providers globales
    │   ├── auth/                # gestión de autenticación (futura)
    │   │   ├── auth.service.js  # única puerta de I/O de auth
    │   │   └── AuthContext.jsx
    │   ├── permissions/         # gestión de permisos (futura)
    │   │   └── PermissionContext.jsx   # can() / canAny() / hasRole()
    │   ├── context/
    │   │   └── UIContext.jsx    # estado de layout (sidebar, drawer móvil)
    │   ├── modules/             # infraestructura del sistema de módulos
    │   │   ├── defineModule.js  # CONTRATO de un módulo (valida el manifiesto)
    │   │   └── registry.js      # registro: genera rutas y navegación
    │   ├── router/
    │   │   ├── AppRouter.jsx    # árbol de rutas generado desde el registro
    │   │   ├── LoginPage.jsx
    │   │   ├── NotFoundPage.jsx
    │   │   ├── RouteErrorBoundary.jsx
    │   │   └── guards/
    │   │       ├── ProtectedRoute.jsx    # exige sesión
    │   │       └── PermissionRoute.jsx   # exige permiso
    │   ├── navigation/
    │   │   ├── useNavigation.js         # nav = registro + permisos + grupos
    │   │   ├── navigationGroups.js      # grupos del sidebar y su orden
    │   │   └── useBreadcrumbs.js        # breadcrumbs desde la ruta activa
    │   ├── layout/
    │   │   ├── MainLayout.jsx           # shell responsive (sidebar+topbar+área)
    │   │   ├── MainLayout.module.css
    │   │   └── components/
    │   │       ├── Sidebar/             # SidebarContent + Sidebar + MobileNavDrawer
    │   │       ├── Topbar/              # Topbar + GlobalSearch
    │   │       └── Breadcrumbs/
    │   ├── hooks/               # hooks compartidos del núcleo
    │   │   ├── useMediaQuery.js
    │   │   ├── useBreakpoint.js
    │   │   ├── useToggle.js
    │   │   └── useDocumentTitle.js
    │   └── services/           # servicios compartidos del núcleo
    │       ├── httpClient.js    # cliente HTTP único (base url, timeout, auth)
    │       └── logger.js
    │
    ├── modules/                 # ────────── MÓDULOS DE NEGOCIO ──────────
    │   ├── index.js             # COMPOSITION ROOT: lista y registra módulos
    │   └── dashboard/           # módulo de referencia (autocontenido)
    │       ├── index.js         # manifiesto: defineModule({...})
    │       ├── config/dashboard.config.js
    │       ├── pages/DashboardPage.jsx
    │       ├── components/      # MetricCard, MetricsGrid, RecentActivityTable
    │       ├── hooks/useDashboardData.js
    │       ├── services/dashboard.service.js
    │       └── styles/Dashboard.module.css
    │
    ├── shared/                  # ────────── REUTILIZABLE (sin negocio) ──────────
    │   ├── components/          # PageHeader, FullScreenLoader…
    │   ├── constants/breakpoints.js
    │   └── utils/               # classNames (cx), formatters
    │
    ├── assets/                  # imágenes, íconos, fuentes
    └── styles/                  # ────────── ESTILOS GLOBALES ──────────
        ├── reset.css
        ├── tokens.css          # DESIGN TOKENS (variables CSS) — fuente de verdad
        ├── global.css
        └── utilities.css
```

Cada **módulo** puede contener las mismas subcarpetas: `pages`, `components`,
`services`, `hooks`, `routes`/`index.js`, `styles`, `config`. Es un mini-proyecto
autocontenido.

---

## 3. Explicación de la arquitectura por capas

La regla de dependencias es unidireccional (Clean Architecture):

```
modules/*  ──►  shared/*  ──►  core/*        (nunca al revés)
     │                            ▲
     └──────── depende de ────────┘
El núcleo NUNCA importa desde modules/. Por eso es "cerrado a modificación".
```

Capas y responsabilidades:

- **`core` (framework).** Todo lo transversal y estable: shell visual, ruteo,
  navegación, temas, autenticación, permisos, hooks/servicios compartidos y —lo
  central— la **infraestructura de módulos** (`defineModule` + `registry`).
  Cambia poco: casi cualquier feature nueva vive en `modules/`.
- **`modules` (negocio).** Cada módulo es una vertical independiente y
  desacoplada. Se comunica con el resto solo a través de contratos del núcleo
  (el manifiesto, los contextos, `httpClient`). Un módulo puede borrarse sin
  afectar a otro.
- **`shared`.** Piezas reutilizables **sin** lógica de negocio (componentes de
  presentación, utilidades de formato, constantes). Si algo "sabe" de clientes o
  ventas, no va acá: va en su módulo.
- **`styles` + `theme`.** Dos vistas de la **misma** paleta: `tokens.css`
  (variables CSS que consumen los CSS Modules) y `palette.js` (que alimenta el
  theme de MUI). Mantenerlas en espejo es lo que hace que MUI y el CSS propio se
  vean como un solo producto.

Separación de responsabilidades dentro de un módulo (ejemplo Dashboard):

```
DashboardPage.jsx      → sólo composición y layout (declarativo)
components/*           → presentación pura (reciben props, no hacen fetch)
hooks/useDashboardData → orquesta estado de carga/errores/refetch
services/*.service.js  → única capa de I/O (hoy mock, mañana httpClient)
config/*.config.js     → qué métricas mostrar, cada cuánto refrescar (datos, no lógica)
```

---

## 4. Flujo de escalabilidad

Cómo crece el sistema sin fricción, paso a paso:

1. **Se crea el módulo** en `src/modules/<nombre>/` con su estructura estándar.
2. **Se describe con un manifiesto** (`defineModule`) que declara `id`, `name`,
   `basePath`, `icon`, `permissions`, ubicación en la navegación y sus `routes`.
3. **Se registra** agregándolo al array de `src/modules/index.js`.
4. En el arranque, `registerModules()` carga los manifiestos en el
   **`moduleRegistry`**.
5. El **router** (`AppRouter`) pide `registry.getRouteObjects()` y arma el árbol
   de rutas; el **sidebar** pide `useNavigation()` y arma el menú. Ambos derivan
   de la **misma** fuente, así que nunca se desincronizan.
6. Los **permisos** filtran automáticamente qué módulos ve cada usuario, tanto en
   la navegación como en el acceso a rutas (guards).

Puntos de escalado adicionales, ya contemplados por el diseño:

- **Feature flags / multi-tenant:** `VITE_ENABLED_MODULES` y el flag `enabled`
  del manifiesto permiten encender/apagar módulos por entorno o por comercio.
- **Lazy loading:** cada `element` de ruta puede envolverse en `React.lazy()` sin
  cambiar el registro; ya hay un `<Suspense>` en el router.
- **Equipos en paralelo:** como los módulos no se tocan entre sí, distintos
  equipos trabajan en `customers/`, `sales/`, `inventory/` sin conflictos de
  merge en el núcleo.

---

## 5. Sistema de registro de módulos

Es el corazón del framework. Un módulo se **auto-describe** con un manifiesto y
el núcleo solo entiende ese contrato.

### 5.1 El contrato — `core/modules/defineModule.js`

```js
export const customersModule = defineModule({
  id: 'customers',                 // único y estable
  name: 'Clientes',                // rótulo visible (futura clave i18n)
  description: 'Gestión de clientes',
  icon: PeopleIcon,                // ícono MUI (opcional)
  enabled: true,                   // feature flag
  basePath: '/customers',          // ruta raíz del módulo
  permissions: ['customers:read'], // requeridos para ver/entrar (opcional)
  navigation: { showInSidebar: true, group: 'operations', order: 20 },
  routes: [
    { path: '',    Component: CustomersListPage, handle: { crumb: 'Clientes' } },
    { path: ':id', Component: CustomerDetailPage },
  ],
});
```

> Las rutas usan el campo `Component` de React Router (en vez de un `element`
> con JSX) para que los manifiestos sean `.js` puros, sin necesidad de la
> transformación de JSX. Las páginas y componentes siguen siendo `.jsx`.

`defineModule` **valida** el manifiesto (falla al arrancar si falta `id`,
`basePath` o `routes`) y aplica defaults. Los errores aparecen en el bootstrap,
no enterrados en runtime.

### 5.2 El registro — `core/modules/registry.js`

Un único `moduleRegistry` que:

- guarda los manifiestos (`register` / `registerAll`),
- filtra los activos (`enabled` + allow-list `VITE_ENABLED_MODULES`),
- **genera las rutas** (`getRouteObjects()`), prefijando cada ruta con el
  `basePath` del módulo,
- **genera la navegación** (`getNavigationItems()`), ordenada por grupo y
  `order`.

Rutas y navegación salen del mismo lugar ⇒ imposible que discrepen.

### 5.3 El composition root — `modules/index.js`

Es el **único** archivo que se edita para sumar un módulo:

```js
import { dashboardModule } from './dashboard';
import { customersModule } from './customers';   // ← nuevo

export const appModules = [
  dashboardModule,
  customersModule,                                // ← nuevo
];

export function registerModules() {
  moduleRegistry.registerAll(appModules);
}
```

---

## 6. Layout principal

`core/layout/MainLayout.jsx` es el *shell* de la aplicación. Compone tres
regiones y **no** contiene lógica de negocio:

- **Sidebar** — fijo y colapsable en desktop; *off-canvas* (MUI `Drawer`) en
  mobile/tablet. El contenido de navegación (`SidebarContent`) es **el mismo** en
  ambos casos: una sola implementación del menú, alimentada por `useNavigation()`.
- **Topbar** — hamburguesa (abre el drawer en mobile / colapsa el sidebar en
  desktop), búsqueda global, toggle de tema, notificaciones y menú de usuario.
- **Área de contenido** — breadcrumbs dinámicos + `<Outlet/>` donde el router
  inyecta la página del módulo activo.

El estado del layout (sidebar colapsado, drawer abierto) vive en `UIContext`,
separado de tema y auth para respetar *Single Responsibility*.

---

## 7. Configuración de rutas

`core/router/AppRouter.jsx` usa el **data router** de React Router
(`createBrowserRouter`) y **genera** el árbol desde el registro:

```
/login                        → pública (LoginPage)
/                             → ProtectedRoute (exige sesión)
  └── MainLayout              → shell
        ├── index            → redirect a /dashboard
        └── …módulos…        → moduleRegistry.getRouteObjects()  (auto)
*                             → NotFoundPage (404)
```

- **Guards** como componentes de ruta: `ProtectedRoute` (sesión) y
  `PermissionRoute` (autorización), combinables por módulo.
- **`RouteErrorBoundary`** aísla errores: una ruta rota no tumba toda la app.
- **Breadcrumbs** se derivan de `handle.crumb` de cada ruta (o del pathname),
  vía `useMatches()`.
- Agregar un módulo **no** modifica este archivo: sus rutas entran por el
  registro.

---

## 8. El módulo Dashboard como referencia

El módulo `dashboard` es la implementación canónica a copiar. Incluye lo pedido:

- **Cards de métricas** (`MetricsGrid` + `MetricCard`): grid responsive (1 → 2 →
  4 columnas) manejado por CSS Modules. Qué métricas se muestran se define en
  `config/dashboard.config.js` (datos, no código).
- **Tabla de actividad reciente** (`RecentActivityTable`): tabla MUI con scroll
  horizontal en pantallas chicas y estados de carga con `Skeleton`.
- **Datos desacoplados**: `services/dashboard.service.js` (hoy mock, mañana
  `httpClient`) + `hooks/useDashboardData.js` (estado de carga/error/refetch).
  La página `DashboardPage.jsx` es solo composición.

Este módulo demuestra las siete subcarpetas del contrato: `pages`, `components`,
`services`, `hooks`, `config`, `styles` e `index.js` (manifiesto/routes).

---

## 9. Buenas prácticas para agregar módulos

1. **Copiá la estructura de `dashboard/`.** Mantené las mismas subcarpetas.
2. **Un `index.js` con `defineModule`.** Es la única superficie pública del
   módulo; el resto de la app no importa archivos internos del módulo.
3. **I/O solo en `services/`.** Nunca hagas `fetch` desde un componente. Usá
   `httpClient` del núcleo para heredar base URL, timeout y (a futuro) el token.
4. **Un hook por pantalla** para el estado (`useXData`). Las páginas quedan
   declarativas.
5. **Estilos en CSS Modules del módulo** usando **tokens** (`var(--crm-…)`).
   Nada de colores hard-codeados ni estilos inline.
6. **Declará permisos** en el manifiesto; los guards y la navegación los
   respetan solos.
7. **No importes de otro módulo.** Si dos módulos necesitan lo mismo, subílo a
   `shared/` (si es genérico) o al `core/` (si es transversal).
8. **Registralo** en `src/modules/index.js`. Fin. Rutas y menú aparecen solos.

Checklist rápida para PR de un módulo nuevo: manifiesto válido · servicios sin
React · página sin fetch · estilos con tokens · permisos declarados · sin
imports cruzados entre módulos.

---

## 10. Convenciones de nombres

- **Carpetas:** `kebab-case` (`sales-orders/`). Nombre = dominio de negocio.
- **Componentes React (archivos y símbolos):** `PascalCase`
  (`MetricCard.jsx` → `export function MetricCard`). Un componente por archivo.
- **Hooks:** `camelCase` con prefijo `use` (`useDashboardData.js`).
- **Servicios:** `<dominio>.service.js`, export objeto `xxxService`.
- **Config:** `<dominio>.config.js`, export objeto `xxxConfig` (con `Object.freeze`).
- **Contextos:** `XxxContext.jsx` con provider `XxxProvider` y hook `useXxx`.
- **CSS Modules:** `Componente.module.css`; clases en `camelCase`
  (`styles.metricCard`).
- **Tokens CSS:** `--crm-<categoría>-<nombre>` (`--crm-color-primary`).
- **`id` de módulo y permisos:** `lowercase`; permisos con forma
  `"<recurso>:<acción>"` (`customers:read`, `sales:create`).
- **Alias de import:** siempre absolutos vía `@core`, `@modules`, `@shared`,
  `@styles` (evitar `../../../`).
- **Barrels (`index.js`):** exponer solo la superficie pública de un paquete.

---

## 11. Sistema de temas

Preparado para **claro**, **oscuro** y **personalización por comercio**:

- **Fuente de verdad doble y en espejo:** `styles/tokens.css` (variables CSS para
  los CSS Modules) y `core/theme/palette.js` (para MUI). Mismos nombres y
  valores.
- **Cambio de modo:** `ThemeModeContext` construye el theme MUI del modo actual y
  además refleja el modo en `<html data-theme="dark|light">`, de modo que el CSS
  propio reacciona al mismo switch. El toggle está en la Topbar.
- **Por comercio (multi-tenant):** `createAppTheme(mode, brandOverrides)` acepta
  overrides; a futuro, cargá la marca del comercio (colores, radios, logo) y
  pasala como overrides + un `data-theme="tenant-x"` con variables propias. Cero
  cambios en componentes.

Reglas de estilo: **MUI solo para componentes** funcionales; **CSS puro/Modules**
para layout y estilos propios; **sin estilos inline** y **sin dependencias de
estilo externas**.

---

## 12. Responsive design

**Mobile-first.** Breakpoints únicos compartidos por JS y CSS
(`shared/constants/breakpoints.js`):

- **Mobile:** `< 768px` — sidebar oculto, menú hamburguesa, cards apiladas.
- **Tablet:** `768–1023px` — drawer + grid intermedio.
- **Desktop:** `>= 1024px` — sidebar fijo, grid de 4 columnas.

`useBreakpoint()` (basado en `matchMedia`) expone `isMobile/isTablet/isDesktop`
usando **los mismos** umbrales que las `@media` de los CSS Modules, así JS y CSS
nunca se contradicen. El grid de métricas pasa de 1 → 2 → 4 columnas y la tabla
adopta scroll horizontal en pantallas chicas.

---

## 13. Recomendaciones empresariales

Para llevar esta base a una plataforma CRM/ERP de nivel empresa, en orden
sugerido:

1. **Data layer:** adoptar **TanStack Query** (React Query) sobre `httpClient`
   para caché, reintentos, invalidación y estados de servidor. Los hooks
   `useXData` ya son el lugar natural para migrarlo.
2. **Autenticación real:** OAuth2/OIDC (Auth0/Keycloak/Cognito), refresh tokens,
   e inyección del `Authorization` en `httpClient`. Todo el cambio queda en
   `auth.service.js`.
3. **Autorización robusta:** RBAC/ABAC con permisos `"<recurso>:<acción>"` (ya
   soportados), más un componente `<Can permission="…">` para gating a nivel UI.
4. **Multi-tenant / white-label:** tema y catálogo de módulos por comercio; feature
   flags server-driven; aislamiento de datos por `tenantId`.
5. **i18n:** `react-i18next`; los `name` de módulos y rótulos ya están listos para
   volverse claves de traducción. Formatos regionales ya usan `Intl`.
6. **Calidad:** **TypeScript** (ver §14), **Vitest + Testing Library** para
   unidad, **Playwright** para E2E, **Storybook** para `shared/` y componentes de
   módulos.
7. **Observabilidad:** enrutar `logger` a Sentry/Datadog; métricas de uso y
   *error boundaries* por módulo.
8. **Rendimiento:** `React.lazy` por módulo/ruta (code-splitting), virtualización
   de tablas grandes, prefetch de rutas probables.
9. **DX y gobierno:** un **generador de módulos** (`plop`/`hygen`) que scaffolds la
   carpeta + manifiesto; ESLint con reglas de límites de import
   (`eslint-plugin-boundaries`) para *prohibir* imports entre módulos y hacia el
   núcleo; CI con lint+test+build.
10. **Backend/contratos:** OpenAPI + cliente generado, o tRPC/GraphQL, para tipar
    la frontera cliente-servidor de punta a punta.
11. **Diseño de sistema:** consolidar `shared/components` como design system
    documentado; tokens versionados.

---

## 14. Migración a TypeScript

La base ya está preparada para adoptar TS incrementalmente:

- Los **alias** están en `jsconfig.json` (se copian tal cual a `tsconfig.json`).
- Los **contratos** ya existen conceptualmente: el manifiesto de módulo, las
  formas de `AuthContext`, `PermissionContext`, etc. Se tipan primero como
  `interfaces`.
- Estrategia sugerida: activar `allowJs` + `checkJs`, renombrar de a poco
  `.js/.jsx → .ts/.tsx` empezando por `core/modules` (el contrato) y
  `shared/utils`, y avanzar módulo por módulo. El desacople permite migrar sin un
  *big bang*.

---

### Resumen

Un **núcleo cerrado y estable** + **módulos autocontenidos** conectados por un
**registro declarativo** que genera rutas y navegación. Sumar funcionalidad es
agregar una carpeta y una línea; el núcleo y los módulos existentes no se tocan.
Esa es la propiedad que sostiene el crecimiento del producto en el tiempo.
