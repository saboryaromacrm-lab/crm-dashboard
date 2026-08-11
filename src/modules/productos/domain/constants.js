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
  // El que pide lo está armando: no es demanda todavía y el origen no lo ve.
  borrador:  { label: 'Armando',     pill: 'est-borrador',  orden: -1 },
  pendiente: { label: 'Pendiente',   pill: 'est-pendiente', orden: 0 },
  preparada: { label: 'En preparación', pill: 'est-preparada', orden: 1 },
  transito:  { label: 'En tránsito', pill: 'est-transito',  orden: 2 },
  recibida:  { label: 'Recibida',    pill: 'est-recibida',  orden: 3 },
  cancelada: { label: 'Cancelada',   pill: 'est-cancelada', orden: 9 },
};

// ---- Estados del envío a Cafetería (el stock acompaña cada uno) ----
/* Dos estados: con el envío ya se da por hecho que coffit recibió — el "viaje"
 * es cruzar la calle. La corrección es EDITAR el envío, no una etapa más. */
export const ESTADOS_ENVIO_CAFE = {
  enviado: { label: 'Enviado', pill: 'est-recibida' },
  anulado: { label: 'Anulado', pill: 'est-cancelada' },
};

/* El pedido del café: demanda, no envío. pendiente → armando → enviado · anulado. */
export const ESTADOS_PEDIDO_CAFE = {
  pendiente: { label: 'Pendiente', pill: 'est-pendiente' },
  armando:   { label: 'Armando',   pill: 'est-transito' },
  enviado:   { label: 'Enviado',   pill: 'est-recibida' },
  anulado:   { label: 'Anulado',   pill: 'est-cancelada' },
};

/**
 * Estados de stock con mercadería VIVA: la que se puede vender o está por
 * moverse. Espejo de `ESTADOS_STOCK_VIVO` de la API — se usa para decidir si un
 * producto se puede archivar, y las dos puntas tienen que mirar lo mismo.
 */
export const ESTADOS_STOCK_VIVO = ['disponible', 'comprometido', 'retenido', 'en_transito'];

/* CICLO DE VIDA DEL PRODUCTO. Dos decisiones distintas, no un interruptor:
 * discontinuado = no se compra más pero SE SIGUE VENDIENDO hasta agotar;
 * archivado = fuera de catálogo (no se compra ni se vende). Ver la 0051. */
export const ESTADOS_PRODUCTO = {
  activo: {
    label: 'Activo', pill: 'est-recibida',
    ayuda: 'Se compra y se vende con normalidad.',
  },
  discontinuado: {
    label: 'Discontinuado', pill: 'est-pendiente',
    ayuda: 'No se trae más, pero se sigue vendiendo hasta agotar el stock. No aparece en las compras ni en la reposición.',
  },
  archivado: {
    label: 'Archivado', pill: 'st-vencido',
    ayuda: 'Fuera de catálogo: no se compra ni se vende. Exige que no quede stock.',
  },
};

/* Rangos del vigía de vencimientos — EXCLUYENTES (lógica de la app original):
 * un registro vive en UNA sola tarjeta, jamás en dos. Los días vienen SIEMPRE
 * calculados por la API contra el calendario argentino — acá no se recalculan. */
export const RANGOS_VENC = {
  vencido: { label: 'Vencido',        pill: 'tag-baja' },
  d7:      { label: 'Urgente (0-7)',  pill: 'est-pendiente' },
  d15:     { label: 'Próximo (8-15)', pill: 'est-preparada' },
  d30:     { label: 'Alerta (16-30)', pill: 'est-transito' },
  vigente: { label: 'Vigente (+30)',  pill: 'est-recibida' },
};
export const rangoVenc = (dias) => (
  dias < 0 ? 'vencido' : dias <= 7 ? 'd7' : dias <= 15 ? 'd15' : dias <= 30 ? 'd30' : 'vigente'
);

/** En qué unidad habla la cantidad de cada renglón del envío. */
export const MODOS_ENVIO_CAFE = {
  granel:  { label: 'Granel (kg)' },
  paquete: { label: 'Paquetes' },
  unidad:  { label: 'Unidades' },
};

/* ---- Estados de una factura de papel subida a la bandeja ----
 * `pendiente` espera que alguien la cargue · `cargada` ya se convirtió en un
 * comprobante (o se enganchó a uno que estaba cargado a mano) · `descartada` no
 * correspondía: duplicada, ilegible o no era nuestra. */
export const ESTADOS_LECTURA = {
  pendiente:  { label: 'Esperando',  pill: 'est-pendiente' },
  cargada:    { label: 'Cargada',    pill: 'est-recibida' },
  descartada: { label: 'Descartada', pill: 'est-cancelada' },
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
  /*
   * LIQUIDACIÓN — la mitad que el proveedor entrega SIN factura.
   *
   * Mueve stock y genera deuda como una factura, pero no es fiscal: sin IVA, sin
   * percepciones, sin CAE, letra X siempre. Se pinta con el tag de merma
   * (`tag-baja`, el rojizo) a propósito: es el único de la lista que no va a
   * ningún libro, y la pantalla tiene que cantarlo sin que nadie lea la ayuda.
   */
  liquidacion:  { label: 'Liquidación (sin factura)', tag: 'tag-baja', noFiscal: true },
  remito:       { label: 'Remito',           tag: 'tag-transf' },
  nota_credito: { label: 'Nota de crédito',  tag: 'tag-baja' },
  nota_debito:  { label: 'Nota de débito',   tag: 'tag-ingreso' },
  orden_compra: { label: 'Orden de compra',  tag: 'tag-ajuste' },
};

/** Tipos que requieren el permiso `liquidaciones` para verse y cargarse. */
export const TIPOS_RESERVADOS = Object.keys(TIPOS_COMPROBANTE).filter((k) => TIPOS_COMPROBANTE[k].noFiscal);
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
