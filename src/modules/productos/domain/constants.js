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
  envio_cafeteria:   { label: 'Envío a Cafetería',   tag: 'tag-venta',   dir: -1 },
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
  preparada: { label: 'En preparación', pill: 'est-preparada', orden: 1 },
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
// Los roles son DINÁMICOS: viven en la base (tabla roles) con su lista de
// permisos, y viajan resueltos en cada usuario del bootstrap (rolClave,
// rolNombre, permisos). El catálogo de claves lo sirve GET /roles/permisos y
// se administra desde Gerencia › Usuarios y roles.

// ---- Umbrales de vencimiento ----
export const DIAS_VENC_ALERTA = 30; // "próximo a vencer"
export const DIAS_VENC_CRITICO = 7;

/**
 * Alícuotas legales de IVA. Lista cerrada y espejo de `ALICUOTAS_IVA` del
 * backend: un IVA tipeado a mano (2.1 en vez de 21) no da error y descalabra
 * todos los precios del producto en silencio.
 *
 * Las categorías ya NO están acá: pasaron a ser un catálogo administrable
 * (`store.state.catalogos.categorias`), junto con marcas y subcategorías.
 */
export const IVA_OPCIONES = [0, 2.5, 5, 10.5, 21, 27];

/**
 * Redondeo del precio de góndola por producto. Se aplica sobre el precio FINAL
 * con IVA. Vacío en el formulario = heredar el de configuración.
 */
export const OPCIONES_REDONDEO_PRECIO = [
  { valor: 0, label: 'Sin redondeo (con centavos)' },
  { valor: 1, label: 'Entero más cercano' },
  { valor: 10, label: 'A $10' },
  { valor: 50, label: 'A $50' },
  { valor: 100, label: 'A $100' },
];

// ---- Comprobantes de compra (Facturación) ----
export const TIPOS_COMPROBANTE = {
  factura:      { label: 'Factura',          tag: 'tag-venta' },
  remito:       { label: 'Remito',           tag: 'tag-transf' },
  nota_credito: { label: 'Nota de crédito',  tag: 'tag-baja' },
  nota_debito:  { label: 'Nota de débito',   tag: 'tag-ingreso' },
  orden_compra: { label: 'Orden de compra',  tag: 'tag-ajuste' },
};
export const ESTADOS_COMPROBANTE = {
  borrador:   { label: 'Borrador',   pill: 'est-pendiente' },
  confirmado: { label: 'Confirmado', pill: 'est-recibida' },
  anulado:    { label: 'Anulado',    pill: 'est-cancelada' },
};
export const LETRAS_COMPROBANTE = ['A', 'B', 'C', 'X'];
export const CONDICIONES_PAGO = { contado: 'Contado', cuenta_corriente: 'Cuenta corriente' };

/**
 * Condición del PROVEEDOR frente al IVA. Define si su comprobante discrimina
 * IVA: un monotributista o exento factura sin IVA, y asumir 21% infla el total.
 */
export const CONDICIONES_IVA_PROV = {
  responsable_inscripto: 'Responsable inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  no_categorizado: 'No categorizado',
};
