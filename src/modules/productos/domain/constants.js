/**
 * DOMAIN CONSTANTS & CATALOGS (Producto / Inventario)
 * ============================================================================
 * Business vocabulary of the inventory engine: movement types, stock states,
 * transfer/incident states, roles and their permissions. Ported verbatim from
 * the original vanilla `app.data.js` so the engine behaves identically.
 *
 * `tag`/`pill` values are CSS class keys resolved against the module stylesheet
 * (see Productos.module.css) — access them with `styles[key]`.
 */

// ---- Tipos de movimiento de inventario ----
// dir: +1 entrada, -1 salida, 0 = depende del contexto (ajuste, transferencia)
export const TIPOS_MOV = {
  compra:            { label: 'Compra',              tag: 'tag-ingreso', dir: +1 },
  fraccionamiento:   { label: 'Fraccionamiento',     tag: 'tag-fracc',   dir: 0 },
  venta_granel:      { label: 'Venta a granel',      tag: 'tag-venta',   dir: -1 },
  venta_fraccionada: { label: 'Venta fraccionada',   tag: 'tag-venta',   dir: -1 },
  devolucion:        { label: 'Devolución',          tag: 'tag-ingreso', dir: +1 },
  ajuste:            { label: 'Ajuste',              tag: 'tag-ajuste',  dir: 0 },
  merma:             { label: 'Merma',               tag: 'tag-baja',    dir: -1 },
  vencido:           { label: 'Producto vencido',    tag: 'tag-baja',    dir: -1 },
  defectuoso:        { label: 'Producto defectuoso', tag: 'tag-baja',    dir: -1 },
  transferencia:     { label: 'Transferencia',       tag: 'tag-transf',  dir: 0 },
};

// ---- Estados de stock ----
export const ESTADOS_STOCK = {
  disponible:   { label: 'Disponible',   pill: 'st-disponible' },
  comprometido: { label: 'Comprometido', pill: 'st-comprometido' },
  retenido:     { label: 'Retenido',     pill: 'st-retenido' },
  defectuoso:   { label: 'Defectuoso',   pill: 'st-defectuoso' },
  vencido:      { label: 'Vencido',      pill: 'st-vencido' },
};

// ---- Estados de transferencia ----
export const ESTADOS_TRANSFER = {
  pendiente: { label: 'Pendiente',   pill: 'est-pendiente', orden: 0 },
  preparada: { label: 'Preparada',   pill: 'est-preparada', orden: 1 },
  transito:  { label: 'En tránsito', pill: 'est-transito',  orden: 2 },
  recibida:  { label: 'Recibida',    pill: 'est-recibida',  orden: 3 },
  cancelada: { label: 'Cancelada',   pill: 'est-cancelada', orden: 9 },
};

// ---- Estados e insumos de incidencias ----
export const ESTADOS_INCIDENCIA = {
  pendiente: { label: 'Pendiente',   pill: 'est-pendiente' },
  revision:  { label: 'En revisión', pill: 'est-revision' },
  resuelta:  { label: 'Resuelta',    pill: 'est-resuelta' },
};
export const TIPOS_INCIDENCIA = [
  'Etiqueta incorrecta', 'Producto mal pesado', 'Bolsa rota',
  'Diferencia de inventario', 'Producto defectuoso', 'Producto vencido',
];

// ---- Roles y permisos ----
// '*' = todos los permisos (Administrador)
export const PERMISOS_ROL = {
  admin:        ['*'],
  fraccionador: ['fraccionar', 'etiquetas', 'merma', 'defectuoso', 'incidencia_crear', 'ver'],
  vendedor:     ['ventas', 'devoluciones', 'diferencias', 'incidencia_crear', 'ver'],
};
export const ROLES = {
  admin:        { label: 'Administrador' },
  fraccionador: { label: 'Fraccionador' },
  vendedor:     { label: 'Vendedor' },
};

// ---- Umbrales de vencimiento ----
export const DIAS_VENC_ALERTA = 30; // "próximo a vencer"
export const DIAS_VENC_CRITICO = 7;

// ---- Categorías de producto ----
export const CATEGORIAS = ['General', 'Alimentos', 'Bebidas', 'Almacén', 'Limpieza', 'Otros'];

// ---- Alícuotas de IVA (por ahora fijas; luego se configuran en otra sección) ----
export const IVA_OPCIONES = [21, 10.5];
