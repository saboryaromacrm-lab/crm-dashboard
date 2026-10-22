/**
 * BAJOS EN STOCK (12/10/2026, pedido del dueño) — la cuenta, en un solo lugar.
 * ============================================================================
 * La usan la sección Almacén › Bajos en stock y el globito del menú: los dos
 * tienen que decir lo mismo.
 *
 * Por producto (activo y no marcado «nunca controlar»), en la sucursal elegida:
 *   · venta diaria = lo vendido en la ventana (30 días) ÷ los días;
 *   · mínimo = el cargado a mano si hay; si no, venta diaria × días a cubrir
 *     (redondeado para arriba: unidades enteras, o de a 0,1 kg en granel);
 *   · SIN STOCK = 0 o menos; BAJO = menos que el mínimo; si no, BIEN. Lo que
 *     no se vendió y no tiene mínimo nunca es «bajo» (no rota), pero en 0 sí
 *     es «sin stock».
 *   · pedir = lo que falta para el mínimo, en el bulto de ese proveedor.
 *
 * Por proveedor (el del formato que fija el precio, para no contar dos veces):
 * % en falta = (sin + bajos) ÷ productos. ROJO desde el umbral (50 %),
 * AMARILLO desde la mitad del umbral, VERDE debajo.
 *
 * LO YA PEDIDO (22/10/2026, pedido del dueño): el proveedor con un pedido en
 * curso (Proveedores › Pedidos) lleva `pedido` (desde cuándo) y, salvo que se
 * pida verlo, queda afuera de la lista y de los colores: ya está resuelto.
 * Vuelve solo cuando el pedido se marca recibido.
 */
/**
 * DE QUIÉN ES LA LISTA (22/10/2026, pedido del dueño): la de Sabor y Aroma no
 * cuenta nada de Coffit —ni lo de su uso exclusivo ni lo que elabora—; la de
 * Almacén › Coffit es solo su depósito. Lo dice la API en `datos.alcance`.
 */
export const ALCANCE_BAJOS = {
  saborYAroma: (p) => !p.soloCafeteria && !p.origenCafeteria,
  coffit: (p) => !!p.soloCafeteria,
};

export const COLOR_PROVEEDOR = {
  rojo: { label: 'En rojo', color: 'var(--crm-color-danger)' },
  amarillo: { label: 'Atención', color: 'var(--crm-color-warning)' },
  verde: { label: 'Bien', color: 'var(--crm-color-success)' },
};
export const ESTADO_PRODUCTO = {
  sin: { label: 'Sin stock', orden: 0, color: 'var(--crm-color-danger)' },
  bajo: { label: 'Bajo', orden: 1, color: 'var(--crm-color-warning)' },
  ok: { label: 'Bien', orden: 2, color: 'var(--crm-color-success)' },
};

/**
 * @param o.productos   el catálogo del store
 * @param o.disponible  (productoId, sucursalId|null) → stock disponible (null = todas)
 * @param o.datos       la respuesta de GET /bajos-stock
 * @param o.proveedorDe (producto) → id del proveedor que fija el precio, o null
 * @param o.controla    (producto) → si se le controla el stock
 * @param o.bultoDe     (producto, proveedorId) → bulto en que se le compra (0 = sin)
 * @param o.soloControlados solo productos que ya pasaron por un control o ajuste
 * @param o.tipo        'entero' | 'granel' | '' (todos): cambia también los % de cada proveedor
 * @param o.verPedidos  incluir a los proveedores que ya tienen un pedido en curso
 */
export function analizarBajos({ productos, disponible, datos, proveedorDe, controla, bultoDe, soloControlados = false, tipo = '', verPedidos = false }) {
  if (!datos) return { proveedores: [], rojos: 0, yaPedidos: 0 };
  const { sucursalId, diasVenta, diasCobertura, umbralRojo } = datos;
  const vendido = new Map(datos.ventas);
  const controlados = soloControlados ? new Set(datos.controlados) : null;
  const deLaLista = ALCANCE_BAJOS[datos.alcance] ?? ALCANCE_BAJOS.saborYAroma;
  const porProv = new Map();

  for (const p of productos) {
    if ((p.estado || 'activo') !== 'activo' || !deLaLista(p) || !controla(p)) continue;
    if (controlados && !controlados.has(p.id)) continue;
    if (tipo && p.tipo !== tipo) continue;
    const granel = p.tipo === 'granel';
    const stock = disponible(p.id, sucursalId);
    const ventaDia = (vendido.get(p.id) ?? 0) / diasVenta;
    const manual = Number(p.stockMin) > 0 ? Number(p.stockMin) : 0;
    const auto = granel ? Math.ceil(ventaDia * diasCobertura * 10) / 10 : Math.ceil(ventaDia * diasCobertura - 1e-9);
    const minimo = manual || auto;
    const estado = stock <= 1e-9 ? 'sin' : (minimo > 0 && stock < minimo - 1e-9 ? 'bajo' : 'ok');
    const provId = proveedorDe(p) ?? 0;
    const bulto = bultoDe(p, provId);
    const falta = Math.max(0, minimo - Math.max(stock, 0));
    const fila = {
      p, estado, stock, ventaDia, minimo, auto, manual: manual > 0, bulto,
      /** Días que alcanza lo que hay, al ritmo de venta (null = no se vende). */
      alcanza: ventaDia > 0 ? Math.max(stock, 0) / ventaDia : null,
      /** Cuánto pedir para llegar al mínimo: bultos si tiene, si no unidades (o kg). */
      pedir: falta > 1e-9 ? Math.ceil(bulto > 1 ? falta / bulto : falta) : 0,
    };
    const g = porProv.get(provId) ?? { id: provId, filas: [], sin: 0, bajos: 0 };
    g.filas.push(fila);
    if (estado === 'sin') g.sin += 1; else if (estado === 'bajo') g.bajos += 1;
    porProv.set(provId, g);
  }

  const pedidoDe = new Map(datos.pedidos ?? []);
  const todos = [...porProv.values()].map((g) => ({ ...g, pedido: pedidoDe.get(g.id) ?? null }));
  const proveedores = todos.filter((g) => verPedidos || !g.pedido).map((g) => {
    const pct = ((g.sin + g.bajos) / g.filas.length) * 100;
    const color = pct >= umbralRojo - 1e-9 ? 'rojo' : pct >= umbralRojo / 2 - 1e-9 ? 'amarillo' : 'verde';
    g.filas.sort((a, b) => ESTADO_PRODUCTO[a.estado].orden - ESTADO_PRODUCTO[b.estado].orden
      || (a.alcanza ?? Infinity) - (b.alcanza ?? Infinity) || a.p.nombre.localeCompare(b.p.nombre, 'es'));
    return { ...g, total: g.filas.length, pct, color };
  }).sort((a, b) => b.pct - a.pct || b.sin - a.sin);

  return {
    proveedores,
    /* El globito cuenta solo lo que falta pedir. */
    rojos: proveedores.filter((g) => g.id && g.color === 'rojo' && !g.pedido).length,
    yaPedidos: todos.filter((g) => g.pedido).length,
  };
}
