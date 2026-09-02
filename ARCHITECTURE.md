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

> **Estado real al 1/9/2026.** Este documento nació como diseño de la base y
> se actualizó ese día para que describa lo que HAY, no lo que iba a haber.
> Lo que ya está implementado y funcionando: autenticación real contra la API
> (`core/auth`, sesión por pestaña con token), permisos por rol en dos niveles
> (`core/permissions`), guards de ruta (`ProtectedRoute` + `ModuleGuard`),
> 10 módulos de negocio, y 9 servicios de núcleo (cliente HTTP, impresión,
> códigos de barras, pollers de avisos, chat). Lo que sigue siendo aspiración
> está marcado como tal en cada sección.

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
    │   │   └── AppProviders.jsx # ThemeMode → Auth → Permission → UI
    │   ├── auth/                # AUTENTICACIÓN REAL contra la API
    │   │   ├── auth.service.js  # login / logout / getCurrentUser (/auth/yo)
    │   │   ├── AuthContext.jsx
    │   │   ├── sesion.js        # sesión POR PESTAÑA (sessionStorage + copia heredable)
    │   │   └── terminal.js      # token del equipo registrado (localStorage)
    │   ├── permissions/
    │   │   └── PermissionContext.jsx   # can() / canAny() — decide qué se MUESTRA
    │   ├── context/
    │   │   └── UIContext.jsx    # estado de layout (sidebar, drawer móvil)
    │   ├── modules/             # infraestructura del sistema de módulos
    │   │   ├── defineModule.js  # CONTRATO de un módulo (valida el manifiesto)
    │   │   └── registry.js      # registro: genera rutas y navegación
    │   ├── router/
    │   │   ├── AppRouter.jsx    # árbol de rutas generado desde el registro
    │   │   ├── HomeRedirect.jsx # "/" → primer módulo que el rol puede ver
    │   │   ├── LoginPage.jsx    # usuario + contraseña + sucursal (dos pasos)
    │   │   ├── NotFoundPage.jsx
    │   │   ├── RouteErrorBoundary.jsx
    │   │   └── guards/
    │   │       ├── ProtectedRoute.jsx    # exige sesión
    │   │       ├── ModuleGuard.jsx       # exige los permisos del módulo (URL tipeada)
    │   │       └── PermissionRoute.jsx   # (sin uso hoy)
    │   ├── navigation/
    │   │   ├── useNavigation.js         # nav = registro + permisos + grupos + badges
    │   │   ├── navigationGroups.js      # grupos del sidebar y su orden
    │   │   └── useBreadcrumbs.js        # breadcrumbs desde la ruta activa
    │   ├── layout/
    │   │   ├── MainLayout.jsx           # shell responsive (sidebar+topbar+área)
    │   │   ├── MainLayout.module.css
    │   │   └── components/
    │   │       ├── Sidebar/             # SidebarContent + Sidebar + MobileNavDrawer
    │   │       ├── Topbar/              # Topbar + GlobalSearch (cambio de sucursal, salir)
    │   │       ├── Breadcrumbs/
    │   │       ├── ChatDock.jsx         # chat interno (poller `chat.js`)
    │   │       ├── OrdenesWebAlert.jsx  # aviso con sonido de pedidos del sitio
    │   │       ├── PedidosCafeAlert.jsx # aviso de pedidos de la cafetería
    │   │       └── PreciosAlert.jsx     # "cambiaron los precios, recargá"
    │   ├── hooks/               # useMediaQuery, useBreakpoint, useDocumentTitle, useToggle
    │   └── services/            # servicios compartidos del núcleo
    │       ├── httpClient.js    # cliente HTTP único: base url, timeout, Bearer, 401 → login
    │       ├── imprimir.js      # motor único de impresión (lee Sistema › Impresión)
    │       ├── barcode.js       # EAN-13 / Code 39 en SVG, sin dependencias
    │       ├── ordenesWeb.js    # poller: pedidos web pendientes (badge + alerta)
    │       ├── pedidosCafe.js   # poller: pedidos de la cafetería
    │       ├── gastosPendientes.js # poller: vencidos + pagos sin aplicar
    │       ├── cambiosPrecio.js # poller: firma del último cambio de precio
    │       ├── chat.js          # poller del chat interno (4 s, latido de presencia)
    │       └── logger.js
    │
    ├── modules/                 # ────────── MÓDULOS DE NEGOCIO ──────────
    │   ├── index.js             # COMPOSITION ROOT: lista y registra los 10 módulos
    │   ├── dashboard/           # /dashboard — resumen del inventario (pages, styles)
    │   ├── compras/             # /compras   — manifiesto; usa `productos/`
    │   ├── almacen/             # /almacen   — manifiesto; usa `productos/`
    │   ├── productos/           # SUBSISTEMA compartido por Compras y Almacén
    │   │                        #   (apps, components, config, context, domain,
    │   │                        #    hooks, pages, panels, services, styles)
    │   ├── proveedores/         # /proveedores — pedidos, cuentas, echeqs, padrón
    │   ├── ventas/              # /ventas — POS, caja, órdenes web, presupuestos…
    │   ├── gastos/              # /gastos — gastos, pagos a proveedor, fijos, rubros
    │   ├── web/                 # /web — administración del sitio público
    │   ├── gerencia/            # /gerencia — usuarios y roles, rentabilidad
    │   ├── sistema/             # /sistema — empresa, impresión, terminales, respaldos
    │   ├── manual/              # /info — documentación viva (contenido, es DATO)
    │   └── consultas/           # atajos globales (Alt+F3/F5); lo monta MainLayout
    │
    ├── shared/                  # ────────── REUTILIZABLE (sin negocio) ──────────
    │   ├── components/          # PageHeader, FullScreenLoader, ComingSoon
    │   ├── constants/breakpoints.js
    │   └── utils/               # classNames (cx), csv, formatters
    │
    ├── assets/                  # imágenes, íconos, fuentes
    └── styles/                  # ────────── ESTILOS GLOBALES ──────────
        ├── reset.css
        ├── tokens.css          # DESIGN TOKENS (variables CSS) — fuente de verdad
        ├── global.css
        └── utilities.css
```

Cada **módulo** puede contener las mismas subcarpetas: `pages`, `components`,
`services`, `hooks`, `routes`/`index.js`, `styles`, `config`, y en los grandes
también `context` (el provider del módulo), `domain` (cálculos puros) y
`panels` (las secciones del submenú). Es un mini-proyecto autocontenido.

**Una excepción conocida y deliberada:** `modules/productos/` no es un módulo
con ruta propia sino el subsistema que comparten Compras y Almacén, y de él
importan además Ventas, Gastos, Proveedores, Web, Gerencia, Sistema y
Consultas (`components/ui.jsx`, `components/Modal.jsx`, `domain/format.js`).
Funciona como librería compartida disfrazada de módulo; lo correcto sería
subir esas piezas a `shared/`. Está anotado como deuda.

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
        ├── index            → HomeRedirect: al PRIMER módulo que el rol puede ver
        └── ModuleGuard      → exige los permisos del módulo (por `handle.moduleId`)
              └── …módulos… → moduleRegistry.getRouteObjects()  (auto)
*                             → NotFoundPage (404)
```

- **Guards** como componentes de ruta: `ProtectedRoute` (sesión) y
  `ModuleGuard` (autorización por módulo, para la URL tipeada a mano).
  `PermissionRoute` existe pero hoy no se usa.
- **`HomeRedirect`** no es un redirect fijo a `/dashboard` (sería un rebote
  infinito con el guard para un rol sin ese permiso): manda al primer módulo
  visible, y si no hay ninguno muestra "Sin secciones asignadas".
- **`RouteErrorBoundary`** aísla errores: una ruta rota no tumba toda la app.
- **Breadcrumbs** se derivan de `handle.crumb` de cada ruta (o del pathname),
  vía `useMatches()`.
- Agregar un módulo **no** modifica este archivo: sus rutas entran por el
  registro.
- **Sub-navegación:** cada módulo declara UNA ruta; sus paneles (Punto de
  venta, Caja, Clientes…) son estado del provider del módulo, no URL. El
  `?panel=<id>` permite enlazar a uno, y se ignora si el rol no lo puede ver.

### 7.1 Autenticación y sesión (implementado)

- `LoginPage` pide `GET /auth/opciones` (solo `{id, nombre}` de usuarios y
  sucursales) y hace `POST /auth/login` con usuario, contraseña y sucursal. Si
  el equipo está registrado como terminal, la sucursal la impone el servidor.
- La sesión (`token`, usuario, sucursal) vive en **`sessionStorage`** —una por
  pestaña— con una copia en `localStorage` que una pestaña nueva hereda
  durante 10 horas (`core/auth/sesion.js`). Dos ventanas pueden operar con
  usuarios y sucursales distintos sin pisarse.
- `httpClient` agrega `Authorization: Bearer` a toda llamada; un **401** limpia
  la sesión y recarga (vuelve al login); un **403** NO cierra sesión (es "tu
  rol no puede", no "tu sesión venció").
- En cada arranque `getCurrentUser()` refresca permisos contra `/auth/yo`; si
  la API no responde, vale la foto guardada al entrar.
- `PermissionContext` decide qué se **muestra**; quién puede hacer qué lo
  decide **el servidor** (guard global de `crm-api`).

---

## 8. Módulos de referencia

El módulo `dashboard` fue la implementación canónica del arranque; hoy es el
más chico (`index.js` + `pages/` + `styles/`) y lee el inventario real desde el
store compartido. **Para copiar la estructura de un módulo completo, mirá
`gastos/` o `proveedores/`**, que tienen el patrón entero:

- `index.js` — manifiesto `defineModule({...})`; los `permissions` se derivan
  de la lista de paneles del `config/`.
- `config/<modulo>.config.js` — los paneles del submenú como **dato** (id,
  rótulo, permiso, badge).
- `context/<Modulo>Context.jsx` — el provider: carga el bootstrap del módulo,
  expone `panel/goPanel`, `modal/openModal/closeModal`, `toast`, `recargar`.
- `pages/<Modulo>Page.jsx` — filtra los paneles por permiso y monta el shell.
- `panels/` — una pantalla por sección; `components/modals/` — los diálogos.
- `services/<modulo>.api.js` — la única capa de I/O, sobre `httpClient`.
- `domain/` — cálculos puros, sin React ni red.
- `hooks/useResource.js` — carga perezosa de listados grandes.

Los datos se cargan de tres formas que conviven: un **store singleton** para
el inventario (`productos/services/inventory.store.js`, compartido por
Compras, Almacén y Dashboard), un **contexto por módulo** (Ventas, Gastos,
Proveedores), y **pollers globales** del núcleo para los avisos.

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
2. **Autenticación:** ya es real (sesiones con token contra la API, ver §7.1).
   Si algún día hace falta OAuth2/OIDC, el cambio sigue quedando encapsulado en
   `auth.service.js` + `sesion.js`.
3. **Autorización robusta:** RBAC/ABAC con permisos `"<recurso>:<acción>"` (ya
   soportados), más un componente `<Can permission="…">` para gating a nivel UI.
4. **Multi-tenant / white-label:** tema y catálogo de módulos por comercio; feature
   flags server-driven; aislamiento de datos por `tenantId`.
5. **i18n:** `react-i18next`; los `name` de módulos y rótulos ya están listos para
   volverse claves de traducción. Formatos regionales ya usan `Intl`.
6. **Calidad:** **TypeScript** (ver §14), **Vitest + Testing Library** para
   unidad, **Playwright** para E2E, **Storybook** para `shared/` y componentes de
   módulos. Hoy el dashboard **no tiene tests**; la CI (`.github/workflows/ci.yml`)
   corre lint (errores) y build en cada push.
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
