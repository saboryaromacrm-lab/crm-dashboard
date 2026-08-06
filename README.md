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

## ⚠️ Necesita la API corriendo

Este CRM **no tiene datos propios**: carga todo desde `crm-api`. Antes de
levantarlo hay que tener la API y PostgreSQL andando.

- Repositorio de la API: **https://github.com/saboryaromacrm-lab/crm-api**
- Ahí está el paso a paso de PostgreSQL, la creación de la base y los volcados
  SQL (`database/schema.sql` y `database/seed-ejemplo.sql`).

Lo mínimo, con los dos proyectos clonados en la misma carpeta:

```bash
# Terminal 1 — la API (crea la base la primera vez)
cd crm-api
npm install && cp .env.example .env      # editá DATABASE_URL con tu password
npm run db:create && npm run db:migrate && npm run db:seed
npm run start:dev                        # http://localhost:3001/api

# Terminal 2 — el CRM
cd crm-dashboard
npm install && cp .env.example .env
npm run dev                              # http://localhost:3000
```

Si la API no responde, el CRM muestra el error de conexión y un botón para
reintentar (no se rompe ni queda en blanco).

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ajustá las variables VITE_*
npm run dev               # entorno de desarrollo (http://localhost:3000)
npm run build             # build de producción -> dist/
npm run preview           # sirve el build para verificarlo
npm run lint              # ESLint
```

### Variables de entorno

| Variable | Para qué | Valor en desarrollo |
|----------|----------|---------------------|
| `VITE_API_BASE_URL` | URL base de `crm-api`. La usa `src/core/services/httpClient.js` para todas las llamadas. | `http://localhost:3001/api` |
| `VITE_APP_NAME` | Nombre que se muestra en la interfaz. | `CRM Dashboard` |
| `VITE_DEFAULT_THEME` | Tema inicial (`light` / `dark`). | `light` |

> El archivo `.env` está en `.gitignore` y **no se sube**: copialo de
> `.env.example` en cada máquina.

> Login real: usuario + contraseña + sucursal, contra la API (`/usuarios`).
> La sesión es **por ventana/pestaña**: dos ventanas pueden operar con
> usuarios y sucursales distintos sin pisarse.

## Módulos

| Módulo | Ruta | Menú interno |
|--------|------|--------------|
| **Compras** | `/compras` | Dashboard · Productos · Catálogos · Proveedores · Facturación (pestañas Facturas / Pagos en sucursal) · Historial |
| **Ventas** | `/ventas` | Punto de venta · Caja · Órdenes web · Presupuestos · Clientes · Cobranzas · Formato de venta · Ofertas · Cambios de precio · Configuración |
| **Almacén** | `/almacen` | Existencias · Fraccionamiento · Transferencias · Operaciones · Incidencias · Cafetería (envíos a coffit) |
| **Gastos** | `/gastos` | Gastos (pestañas Gastos / Pagos en sucursal) · Cuentas a pagar · Gastos fijos · Rubros · Proveedores · Resumen |
| **Web** | `/web` | Administración del sitio (productos publicados, ofertas, contenido, estadísticas, configuración) |
| **Gerencia** | `/gerencia` | Usuarios y roles (permisos por sección y acción) · Reportes (en construcción) |
| **Sistema** | `/sistema` | Empresa · Impresión (formatos por documento) · Respaldos |
| **Info de sistema** | `/info` | La guía viva: cómo trabaja cada proceso, decisiones de diseño, registro de cambios y pendientes |

Compras y Almacén comparten el subsistema de `src/modules/productos/`; Ventas y
Gastos son módulos propios con su store/contexto. La visibilidad de cada
sección la deciden los **permisos del rol** (dos niveles: secciones y acciones).

## Estructura (resumen)

```
src/
├── core/       # Núcleo del framework: layout, router, navegación, temas,
│               # auth, permisos, hooks y servicios compartidos, registro de módulos.
├── modules/    # Módulos de negocio, cada uno 100% autocontenido.
│   ├── productos/  # Subsistema compartido por Compras y Almacén (incl. Cafetería)
│   ├── ventas/     # POS, caja, órdenes web, presupuestos, clientes, ofertas
│   ├── gastos/     # Gastos, pagos a proveedores, cuentas a pagar, fijos
│   ├── web/        # Administración del sitio público (sitio-web)
│   ├── gerencia/   # Usuarios y roles
│   ├── sistema/    # Empresa, impresión, respaldos
│   ├── manual/     # Info de sistema (documentación viva, es DATO)
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
