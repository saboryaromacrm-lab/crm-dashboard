/**
 * INVENTARIO — configuración de los menús internos.
 * ============================================================================
 * El subsistema de inventario alimenta DOS módulos del CRM que comparten el
 * mismo motor (singleton): **Compras** y **Almacén**. Cada uno define su propio
 * sub-menú (sub-sidebar izquierdo) con este catálogo. Es DATO, no lógica.
 *
 * Sin lote: se quitaron Presentaciones (se editan en el detalle del producto),
 * Vencimientos y Trazabilidad (eran por lote). Sucursales, Transferencias e
 * Incidencias viven en Almacén.
 */
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PercentIcon from '@mui/icons-material/Percent';
import SellIcon from '@mui/icons-material/Sell';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import HistoryIcon from '@mui/icons-material/History';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FactCheckIcon from '@mui/icons-material/FactCheck';

/**
 * Menú interno del módulo COMPRAS.
 *
 * Existencias y Fraccionamiento viven solo en Almacén: son operación de
 * depósito, no de compra, y tenerlas en los dos lados obligaba a mantener la
 * misma pantalla en dos menús.
 *
 * `permiso` es la clave de SECCIÓN del catálogo de permisos: un rol sin esa
 * clave no ve el panel, y sin ninguna del módulo no ve el módulo entero.
 */
export const COMPRAS_PANELS = [
  /*
   * SIN "Dashboard" (18/8/2026, pedido del dueño): el resumen del inventario se
   * mudó al **Dashboard del menú principal**, que hasta entonces mostraba
   * métricas de ejemplo. Tener el resumen real escondido adentro de Compras y
   * datos inventados en la puerta de entrada era exactamente al revés.
   */
  { id: 'productos',      label: 'Productos',      icon: Inventory2Icon,     permiso: 'compras.productos' },
  /*
   * MÁRGENES (16/9/2026, pedido del dueño): el mapa de markups del catálogo
   * entero, para dejar de entrar producto por producto a ver qué margen tiene
   * cada uno. Va pegado a Productos porque es la misma pregunta mirada al
   * revés —del valor hacia los productos, y no del producto hacia su valor— y
   * lleva su mismo permiso: muestra costos.
   */
  { id: 'margenes',       label: 'Márgenes',       icon: PercentIcon,        permiso: 'compras.productos' },
  { id: 'catalogos',      label: 'Catálogos',      icon: SellIcon,           permiso: 'compras.catalogos' },
  /*
   * El ABM de la ficha se mudó al MÓDULO Proveedores (0068). Acá queda solo lo
   * OPERATIVO de compras que no tiene reemplazo allá: los costos por producto
   * (con la regla masiva), las percepciones y la cuenta del proveedor.
   */
  { id: 'proveedores',    label: 'Costos y percepciones', icon: LocalShippingIcon, permiso: 'compras.proveedores' },
  { id: 'lecturas',       label: 'Por procesar',   icon: DocumentScannerIcon, permiso: 'compras.lecturas', badge: 'lecturas' },
  { id: 'facturacion',    label: 'Facturación',    icon: ReceiptLongIcon,    permiso: 'compras.facturacion' },
  { id: 'historial',      label: 'Historial',      icon: HistoryIcon,        permiso: 'compras.historial' },
];

/** Menú interno del módulo ALMACÉN. */
export const ALMACEN_PANELS = [
  /*
   * Existencias trae adentro la pestaña Movimientos (27/8, pedido del dueño):
   * la película de la foto, sin cruzar a Compras › Historial ni gastar una
   * entrada del menú. Ver ExistenciasPanel.
   */
  { id: 'existencias',    label: 'Existencias',    icon: WarehouseIcon,      permiso: 'almacen.existencias' },
  /*
   * El físico contra el virtual (0066): sesiones de conteo con la lista
   * congelada, ciegas por defecto, que se aplican por diferencia. Vive al lado
   * de Existencias porque es su contraparte: una muestra lo que el sistema
   * cree, la otra lo verifica contra la góndola.
   */
  { id: 'conteos',        label: 'Control de stock', icon: FactCheckIcon,    permiso: 'almacen.conteos' },
  { id: 'fraccionamiento', label: 'Fraccionamiento', icon: CallSplitIcon,    permiso: 'almacen.fraccionamiento' },
  { id: 'transferencias', label: 'Transferencias', icon: SwapHorizIcon,      permiso: 'almacen.transferencias', badge: 'transferencias' },
  { id: 'operaciones',    label: 'Operaciones',    icon: ReceiptLongIcon,    permiso: 'almacen.operaciones' },
  { id: 'incidencias',    label: 'Incidencias',    icon: ReportProblemIcon,  permiso: 'almacen.incidencias', badge: 'incidencias' },
  /*
   * El vigía de fechas (lógica de la app externa, datos 100% del sistema):
   * control por sucursal, alertas 7/15/30, procesar vencidos, ofertas y mermas.
   * El globito son los que APURAN: vencidos sin procesar + vencen en ≤7 días.
   */
  { id: 'vencimientos',   label: 'Vencimientos',   icon: EventBusyIcon,      permiso: 'almacen.vencimientos', badge: 'vencimientos' },
  // Punto de SALIDA hacia coffit: el CRM no lleva el stock del café. El globito
  // avisa la demanda del café que espera (pedidos pendientes o armándose).
  /* Dos permisos: la distribuidora entra por `almacen.cafeteria` y el rol
     Cafetería por el suyo — es la misma pantalla, y cada uno ve y opera lo
     que la API le deja. Sin esto, el rol Cafetería no tenía cómo llegar. */
  /* `labelCafe`: cómo se llama la sección para el rol Cafetería. Para ella,
     "Cafetería" es su propio nombre — el otro lado del puente se llama
     "Sabor y Aroma". Ver `domain/cafeteria.voz.js`. */
  { id: 'cafeteria',      label: 'Cafetería',      labelCafe: 'Sabor y Aroma',      icon: LocalCafeIcon,      permiso: ['almacen.cafeteria', 'almacen.cafeteria-entradas'], badge: 'pedidosCafe' },
  /*
   * La pantalla DE la cafetería: armar el pedido a la distribuidora. Es la
   * única sección del rol Cafetería — ese usuario entra al CRM y ve SOLO esto.
   */
  /*
   * La puerta chica al catálogo del café: la cafetería da de alta lo que
   * elabora sin entrar a Compras › Productos, que abre el catálogo entero con
   * precios, costos y proveedores. Escribir es de `almacen.cafeteria-entradas`
   * (café y admin); mirar, de toda la sección.
   */
  { id: 'cafeteria-productos', label: 'Productos Coffit', labelCafe: 'Mis productos', icon: BakeryDiningIcon, permiso: ['almacen.cafeteria', 'almacen.cafeteria-entradas'] },
  { id: 'cafeteria-pedidos', label: 'Pedido a la distribuidora', labelCafe: 'Pedido a Sabor y Aroma', icon: LocalCafeIcon, permiso: 'almacen.cafeteria-pedidos' },
];
