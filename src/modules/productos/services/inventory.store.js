/**
 * INVENTORY STORE — estado, persistencia y operaciones (SIN LOTE).
 * ============================================================================
 * El motor del inventario. Modelo de stock: **Producto × Sucursal × Presentación
 * × Estado**. Se eliminó la dimensión de lote de raíz: no hay FEFO ni
 * vencimientos/trazabilidad por lote. La Compra puede registrar un vencimiento y
 * proveedor como metadato informativo del movimiento, pero no crea un lote.
 *
 * Regla de oro: todo cambio de stock genera un movimiento. Es la única capa que
 * muta el estado y toca `localStorage`. No conoce React: expone `subscribe` /
 * `getVersion` para consumirse con `useSyncExternalStore` (ver useInventory.js).
 *
 * Este motor es compartido por los módulos Compras y Almacén (mismo singleton).
 */
import { TIPOS_MOV, PERMISOS_ROL } from '../domain/constants.js';
import { iso, num, money, fmtTam, fmtFecha } from '../domain/format.js';

const STORAGE_KEY = 'inv_dietetica_v4';

let state = nuevoEstado();
let _muted = false;

/* ---------------- Reactividad (pub/sub para React) ---------------- */
let _version = 0;
const _listeners = new Set();
function emit() {
  _version += 1;
  _listeners.forEach((l) => l());
}
function subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
function getVersion() {
  return _version;
}

function nuevoEstado() {
  return {
    sucursales: [], proveedores: [], usuarios: [], productos: [],
    stock: [], movimientos: [], transferencias: [], incidencias: [],
    seq: { producto: 1, presentacion: 1, stock: 1, mov: 1, transfer: 1, incidencia: 1, proveedor: 1, usuario: 1, sucursal: 1 },
    ctx: { sucursalId: null, usuarioId: null },
  };
}

/* ---------------- Persistencia ---------------- */
function save() {
  if (_muted) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn(e);
  }
  emit();
}
function load() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) { state = JSON.parse(r); return true; }
  } catch (e) {
    console.warn(e);
  }
  return false;
}

/* ---------------- Getters ---------------- */
const getProducto = (id) => state.productos.find((x) => x.id === id);
const getSucursal = (id) => state.sucursales.find((x) => x.id === id);
const getProveedor = (id) => state.proveedores.find((x) => x.id === id);
const getUsuario = (id) => state.usuarios.find((x) => x.id === id);
function presDe(prod, presId) { return prod && prod.presentaciones ? prod.presentaciones.find((p) => p.id === presId) : null; }
function distribuidora() { return state.sucursales.find((s) => s.tipo === 'distribuidora'); }

function unidadDe(prod, presId) { return (prod.tipo === 'granel' && !presId) ? 'kg' : 'u'; }
function presLabel(prod, presId) {
  if (!presId) return prod.tipo === 'granel' ? 'Granel (kg)' : 'Unidad';
  const p = presDe(prod, presId);
  return p ? fmtTam(p.tamKg) : 'Paquete';
}
function fmtCant(prod, presId, cantidad) {
  if (unidadDe(prod, presId) === 'kg') return num(cantidad, 3) + ' kg';
  return Math.round(cantidad) + (presId ? ' paq.' : ' u.');
}

function ok(x) { return Object.assign({ ok: true }, x || {}); }
function err(m) { return { ok: false, error: m }; }

/* ---------------- Núcleo de stock (Producto × Sucursal × Presentación × Estado) ---------------- */
function _entry(productoId, sucursalId, presId, estado, crear) {
  presId = presId || null;
  let e = state.stock.find((st) =>
    st.productoId === productoId && st.sucursalId === sucursalId &&
    (st.presentacionId || null) === presId && st.estado === estado);
  if (!e && crear) {
    e = { id: state.seq.stock++, productoId, sucursalId, presentacionId: presId, estado, cantidad: 0 };
    state.stock.push(e);
  }
  return e;
}
function cant(productoId, sucursalId, presId, estado) {
  const e = _entry(productoId, sucursalId, presId, estado, false);
  return e ? e.cantidad : 0;
}
// suma con filtros libres (cualquier campo null = no filtra)
function suma(f) {
  return state.stock.reduce((acc, st) => {
    if (f.productoId != null && st.productoId !== f.productoId) return acc;
    if (f.sucursalId != null && st.sucursalId !== f.sucursalId) return acc;
    if (f.presentacionId !== undefined && (st.presentacionId || null) !== (f.presentacionId || null)) return acc;
    if (f.estado != null && st.estado !== f.estado) return acc;
    return acc + st.cantidad;
  }, 0);
}
// mueve cantidad de un estado a otro (misma coordenada). Devuelve bool.
function _move(productoId, sucursalId, presId, desde, hacia, c) {
  const from = _entry(productoId, sucursalId, presId, desde, true);
  if (from.cantidad + 1e-9 < c) return false;
  from.cantidad -= c;
  _entry(productoId, sucursalId, presId, hacia, true).cantidad += c;
  return true;
}

/* ---------------- Movimientos ---------------- */
function _mov(campos) {
  const prod = getProducto(campos.productoId);
  const suc = getSucursal(campos.sucursalId);
  const usr = getUsuario(campos.usuarioId != null ? campos.usuarioId : state.ctx.usuarioId);
  const mov = Object.assign({
    id: state.seq.mov++, fecha: iso(new Date()),
    productoNombre: prod ? prod.nombre : '',
    sucursalNombre: suc ? suc.nombre : '', usuarioId: usr ? usr.id : null, usuarioNombre: usr ? usr.nombre : '—',
    signo: 0, cantidad: 0, unidad: '', motivo: '', presLabel: '',
    estadoDesde: null, estadoHacia: null, sucursalDestinoId: null, sucursalDestinoNombre: null,
    vencimiento: null, proveedorNombre: '',
    refTransferenciaId: null, refIncidenciaId: null, descripcion: '',
  }, campos);
  state.movimientos.push(mov);
  return mov;
}
function movimientosDe(productoId) {
  return state.movimientos.filter((m) => m.productoId === productoId).sort((a, b) => b.id - a.id);
}

/* ---------------- Permisos ---------------- */
function rolActual() {
  const u = getUsuario(state.ctx.usuarioId);
  return u ? u.rol : 'vendedor';
}
function can(perm) {
  const ps = PERMISOS_ROL[rolActual()] || [];
  return ps.indexOf('*') >= 0 || ps.indexOf(perm) >= 0;
}
// Movimientos simples que el rol activo puede registrar (devolución/ajuste/merma/…).
function tiposMovPermitidos() {
  const r = rolActual();
  if (r === 'admin') return ['devolucion', 'ajuste', 'merma', 'vencido', 'defectuoso'];
  if (r === 'fraccionador') return ['merma', 'defectuoso'];
  if (r === 'vendedor') return ['devolucion'];
  return [];
}

/* ---------------- Operaciones ---------------- */

// Compra: ingresa mercadería y suma stock disponible. Vencimiento/proveedor = metadato del movimiento.
function opCompra(o) {
  const prod = getProducto(o.productoId); if (!prod) return err('Producto inválido.');
  const c = Number(o.cantidad); if (!(c > 0)) return err('Ingresá una cantidad mayor a 0.');
  const sucId = o.sucursalId || (distribuidora() && distribuidora().id);
  _entry(prod.id, sucId, null, 'disponible', true).cantidad += c;
  const prov = getProveedor(o.proveedorId);
  // El proveedor con el que se compra queda registrado en el producto y marcado
  // como el activo ("vino esta última vez"). El costo/desc/flete se editan aparte.
  if (prov) {
    if (!prod.proveedores) prod.proveedores = [];
    if (!prod.proveedores.find((e) => e.proveedorId === prov.id)) prod.proveedores.push({ proveedorId: prov.id, costo: 0, descuento: 0, flete: 0 });
    prod.proveedorActivoId = prov.id;
  }
  const venc = o.fechaVencimiento ? iso(o.fechaVencimiento) : null;
  _mov({ tipo: 'compra', productoId: prod.id, sucursalId: sucId, signo: 1, cantidad: c, unidad: unidadDe(prod, null),
    estadoHacia: 'disponible', presLabel: presLabel(prod, null), usuarioId: o.usuarioId, vencimiento: venc, proveedorNombre: prov ? prov.nombre : '',
    motivo: o.motivo || (prov ? 'Prov: ' + prov.nombre : ''),
    descripcion: 'Compra +' + fmtCant(prod, null, c) + (prov ? ' · ' + prov.nombre : '') + (venc ? ' · vence ' + fmtFecha(venc) : '') });
  save(); return ok();
}

// Fraccionamiento: descuenta granel y crea paquetes (misma sucursal).
function opFraccionar(o) {
  const prod = getProducto(o.productoId); if (!prod || prod.tipo !== 'granel') return err('Solo productos a granel se fraccionan.');
  const sucId = o.sucursalId;
  let total = 0; const detalle = [];
  (o.asignaciones || []).forEach((a) => {
    const pr = presDe(prod, a.presId); const q = Math.round(Number(a.cant) || 0);
    if (pr && q > 0) { total += q * pr.tamKg; detalle.push(q + '×' + fmtTam(pr.tamKg)); a._pr = pr; a._q = q; }
  });
  if (total <= 0) return err('Indicá al menos un paquete a fraccionar.');
  const disp = cant(prod.id, sucId, null, 'disponible');
  if (total > disp + 1e-9) return err('No alcanza el granel disponible. Disponible: ' + num(disp, 3) + ' kg, necesario: ' + num(total, 3) + ' kg.');
  _entry(prod.id, sucId, null, 'disponible', true).cantidad -= total;
  o.asignaciones.forEach((a) => { if (a._pr) _entry(prod.id, sucId, a._pr.id, 'disponible', true).cantidad += a._q; });
  _mov({ tipo: 'fraccionamiento', productoId: prod.id, sucursalId: sucId, signo: 0, cantidad: total, unidad: 'kg',
    presLabel: 'Granel → paquetes', usuarioId: o.usuarioId,
    descripcion: 'Fraccionó ' + num(total, 3) + ' kg en ' + detalle.join(', ') });
  save(); return ok();
}

// Venta (a granel / fraccionada / unidad).
function opVenta(o) {
  const prod = getProducto(o.productoId); if (!prod) return err('Producto inválido.');
  const sucId = o.sucursalId; const presId = o.presId || null;
  const esGranelSuelto = prod.tipo === 'granel' && !presId;
  const c = Number(o.cantidad); if (!(c > 0)) return err('Ingresá la cantidad.');
  const disp = cant(prod.id, sucId, presId, 'disponible');
  if (c > disp + 1e-9) return err('Stock insuficiente. Disponible: ' + fmtCant(prod, presId, disp) + '.');
  _entry(prod.id, sucId, presId, 'disponible', true).cantidad -= c;
  const precioU = presId ? precioPresentacion(prod, presId) : precioBaseVenta(prod);
  const importe = c * precioU;
  const tipo = esGranelSuelto ? 'venta_granel' : 'venta_fraccionada';
  _mov({ tipo, productoId: prod.id, sucursalId: sucId, signo: -1, cantidad: c, unidad: unidadDe(prod, presId),
    estadoDesde: 'disponible', presLabel: presLabel(prod, presId), usuarioId: o.usuarioId,
    descripcion: (esGranelSuelto ? 'Venta suelta ' : 'Venta ') + fmtCant(prod, presId, c) + ' · ' + money(importe) });
  save(); return ok({ importe });
}

// Movimiento simple: devolución (+), ajuste (±), merma (−), vencido (−→vencido), defectuoso (−→defectuoso).
function opSimple(o) {
  const prod = getProducto(o.productoId); if (!prod) return err('Producto inválido.');
  const tipo = o.tipo; const meta = TIPOS_MOV[tipo]; if (!meta) return err('Tipo inválido.');
  const sucId = o.sucursalId; const presId = o.presId || null;
  const c = Number(o.cantidad); if (!(c > 0)) return err('Ingresá una cantidad mayor a 0.');
  let signo = meta.dir; if (signo === 0) signo = Number(o.signo) === 1 ? 1 : -1; // ajuste
  if (signo < 0) {
    const disp = cant(prod.id, sucId, presId, 'disponible');
    if (c > disp + 1e-9) return err('Stock disponible insuficiente. Disponible: ' + fmtCant(prod, presId, disp) + '.');
  }
  const entry = _entry(prod.id, sucId, presId, 'disponible', true);
  entry.cantidad += signo * c;
  let estadoHacia = signo > 0 ? 'disponible' : null;
  if (tipo === 'vencido') { _entry(prod.id, sucId, presId, 'vencido', true).cantidad += c; estadoHacia = 'vencido'; }
  else if (tipo === 'defectuoso') { _entry(prod.id, sucId, presId, 'defectuoso', true).cantidad += c; estadoHacia = 'defectuoso'; }
  _mov({ tipo, productoId: prod.id, sucursalId: sucId, signo, cantidad: c, unidad: unidadDe(prod, presId),
    estadoDesde: signo < 0 ? 'disponible' : null, estadoHacia, presLabel: presLabel(prod, presId), usuarioId: o.usuarioId, motivo: o.motivo || '',
    descripcion: meta.label + ' ' + (signo > 0 ? '+' : '−') + fmtCant(prod, presId, c) + (o.motivo ? ' · ' + o.motivo : '') });
  save(); return ok();
}

/* ---------------- Transferencias ---------------- */
function crearTransferencia(o) {
  const origen = getSucursal(o.origenId), destino = getSucursal(o.destinoId);
  if (!origen || !destino || origen.id === destino.id) return err('Elegí origen y destino distintos.');
  const items = (o.items || []).filter((it) => Number(it.cantidad) > 0);
  if (!items.length) return err('Agregá al menos un ítem con cantidad.');
  for (let i = 0; i < items.length; i++) {
    const it = items[i]; const prod = getProducto(it.productoId);
    const disp = cant(it.productoId, origen.id, it.presId || null, 'disponible');
    if (Number(it.cantidad) > disp + 1e-9) return err('Sin stock disponible de ' + (prod ? prod.nombre : '') + ' en ' + origen.nombre + '.');
  }
  const t = { id: state.seq.transfer++, codigo: '', fecha: iso(new Date()), origenId: origen.id, destinoId: destino.id,
    usuarioId: o.usuarioId != null ? o.usuarioId : state.ctx.usuarioId, estado: 'pendiente',
    items: items.map((it) => ({ productoId: it.productoId, presId: it.presId || null, cantidad: Number(it.cantidad) })),
    hist: [] };
  t.codigo = 'TR' + String(t.id).padStart(4, '0');
  state.transferencias.push(t);
  t.hist.push({ estado: 'pendiente', fecha: t.fecha, usuarioId: t.usuarioId });
  // Reserva en origen: disponible -> comprometido
  t.items.forEach((it) => {
    _move(it.productoId, origen.id, it.presId, 'disponible', 'comprometido', it.cantidad);
    const prod = getProducto(it.productoId);
    _mov({ tipo: 'transferencia', productoId: it.productoId, sucursalId: origen.id, signo: 0, cantidad: it.cantidad,
      unidad: unidadDe(prod, it.presId), estadoDesde: 'disponible', estadoHacia: 'comprometido', presLabel: presLabel(prod, it.presId),
      sucursalDestinoId: destino.id, sucursalDestinoNombre: destino.nombre, refTransferenciaId: t.id, usuarioId: t.usuarioId,
      descripcion: t.codigo + ': reserva ' + fmtCant(prod, it.presId, it.cantidad) + ' para ' + destino.nombre });
  });
  save(); return ok({ id: t.id });
}
function avanzarTransferencia(id) {
  const t = state.transferencias.find((x) => x.id === id); if (!t) return err('Transferencia inexistente.');
  const orden = ['pendiente', 'preparada', 'transito', 'recibida'];
  const idx = orden.indexOf(t.estado);
  if (idx < 0 || idx >= orden.length - 1) return err('La transferencia ya está en su estado final.');
  const siguiente = orden[idx + 1];
  if (siguiente === 'transito') {
    // sale del origen: comprometido -> (fuera). Registra salida.
    t.items.forEach((it) => {
      const e = _entry(it.productoId, t.origenId, it.presId, 'comprometido', true);
      e.cantidad -= it.cantidad;
      const prod = getProducto(it.productoId);
      _mov({ tipo: 'transferencia', productoId: it.productoId, sucursalId: t.origenId, signo: -1, cantidad: it.cantidad,
        unidad: unidadDe(prod, it.presId), estadoDesde: 'comprometido', presLabel: presLabel(prod, it.presId),
        sucursalDestinoId: t.destinoId, sucursalDestinoNombre: getSucursal(t.destinoId).nombre, refTransferenciaId: t.id,
        descripcion: t.codigo + ': salida de ' + getSucursal(t.origenId).nombre });
    });
  } else if (siguiente === 'recibida') {
    // llega al destino: disponible +=
    t.items.forEach((it) => {
      _entry(it.productoId, t.destinoId, it.presId, 'disponible', true).cantidad += it.cantidad;
      const prod = getProducto(it.productoId);
      _mov({ tipo: 'transferencia', productoId: it.productoId, sucursalId: t.destinoId, signo: 1, cantidad: it.cantidad,
        unidad: unidadDe(prod, it.presId), estadoHacia: 'disponible', presLabel: presLabel(prod, it.presId),
        refTransferenciaId: t.id, descripcion: t.codigo + ': recepción en ' + getSucursal(t.destinoId).nombre });
    });
  }
  t.estado = siguiente;
  t.hist.push({ estado: siguiente, fecha: iso(new Date()), usuarioId: state.ctx.usuarioId });
  save(); return ok();
}
function cancelarTransferencia(id) {
  const t = state.transferencias.find((x) => x.id === id); if (!t) return err('Transferencia inexistente.');
  if (t.estado !== 'pendiente' && t.estado !== 'preparada') return err('Solo se cancelan transferencias pendientes o preparadas.');
  t.items.forEach((it) => {
    _move(it.productoId, t.origenId, it.presId, 'comprometido', 'disponible', it.cantidad);
    const prod = getProducto(it.productoId);
    _mov({ tipo: 'transferencia', productoId: it.productoId, sucursalId: t.origenId, signo: 0, cantidad: it.cantidad,
      unidad: unidadDe(prod, it.presId), estadoDesde: 'comprometido', estadoHacia: 'disponible', presLabel: presLabel(prod, it.presId),
      refTransferenciaId: t.id, descripcion: t.codigo + ': cancelada, stock liberado' });
  });
  t.estado = 'cancelada'; t.hist.push({ estado: 'cancelada', fecha: iso(new Date()), usuarioId: state.ctx.usuarioId });
  save(); return ok();
}

/* ---------------- Incidencias ---------------- */
function crearIncidencia(o) {
  const prod = getProducto(o.productoId); if (!prod) return err('Producto inválido.');
  const sucId = o.sucursalId; const presId = o.presId || null;
  const c = Number(o.cantidad); if (!(c > 0)) return err('Ingresá la cantidad comprometida.');
  const disp = cant(prod.id, sucId, presId, 'disponible');
  if (c > disp + 1e-9) return err('No hay tanto stock disponible. Disponible: ' + fmtCant(prod, presId, disp) + '.');
  _move(prod.id, sucId, presId, 'disponible', 'comprometido', c);
  const inc = { id: state.seq.incidencia++, codigo: '', fecha: iso(new Date()), tipo: o.tipo, estado: 'pendiente',
    responsableId: o.responsableId != null ? o.responsableId : state.ctx.usuarioId, motivo: o.motivo || '',
    productoId: prod.id, sucursalId: sucId, presId, cantidad: c, unidad: unidadDe(prod, presId), resolucion: null };
  inc.codigo = 'INC' + String(inc.id).padStart(4, '0');
  state.incidencias.push(inc);
  _mov({ tipo: 'ajuste', productoId: prod.id, sucursalId: sucId, signo: 0, cantidad: c, unidad: unidadDe(prod, presId),
    estadoDesde: 'disponible', estadoHacia: 'comprometido', presLabel: presLabel(prod, presId), refIncidenciaId: inc.id, usuarioId: inc.responsableId,
    descripcion: inc.codigo + ' (' + o.tipo + '): ' + fmtCant(prod, presId, c) + ' a comprometido' });
  save(); return ok({ id: inc.id });
}
function avanzarIncidencia(id) {
  const inc = state.incidencias.find((x) => x.id === id); if (!inc) return err('Incidencia inexistente.');
  if (inc.estado === 'pendiente') { inc.estado = 'revision'; save(); return ok(); }
  return err("Usá 'Resolver' para cerrar la incidencia.");
}
// resolucion: liberar | merma | vencido | defectuoso
function resolverIncidencia(id, resolucion) {
  const inc = state.incidencias.find((x) => x.id === id); if (!inc) return err('Incidencia inexistente.');
  if (inc.estado === 'resuelta') return err('La incidencia ya está resuelta.');
  const prod = getProducto(inc.productoId); const c = inc.cantidad;
  const comprom = cant(prod.id, inc.sucursalId, inc.presId, 'comprometido');
  if (c > comprom + 1e-9) return err('El stock comprometido cambió; revisá manualmente.');
  let tipoMov = 'ajuste', estadoHacia = null;
  _entry(prod.id, inc.sucursalId, inc.presId, 'comprometido', true).cantidad -= c;
  if (resolucion === 'liberar') { _entry(prod.id, inc.sucursalId, inc.presId, 'disponible', true).cantidad += c; estadoHacia = 'disponible'; }
  else if (resolucion === 'merma') { tipoMov = 'merma'; }
  else if (resolucion === 'vencido') { tipoMov = 'vencido'; _entry(prod.id, inc.sucursalId, inc.presId, 'vencido', true).cantidad += c; estadoHacia = 'vencido'; }
  else if (resolucion === 'defectuoso') { tipoMov = 'defectuoso'; _entry(prod.id, inc.sucursalId, inc.presId, 'defectuoso', true).cantidad += c; estadoHacia = 'defectuoso'; }
  else return err('Resolución inválida.');
  inc.estado = 'resuelta'; inc.resolucion = resolucion; inc.fechaResolucion = iso(new Date());
  _mov({ tipo: tipoMov, productoId: prod.id, sucursalId: inc.sucursalId, signo: resolucion === 'liberar' ? 0 : -1, cantidad: c,
    unidad: inc.unidad, estadoDesde: 'comprometido', estadoHacia, presLabel: presLabel(prod, inc.presId), refIncidenciaId: inc.id,
    descripcion: inc.codigo + ' resuelta: ' + (resolucion === 'liberar' ? 'liberado a disponible' : 'baja por ' + resolucion) });
  save(); return ok();
}

/* ---------------- CRUD catálogo ---------------- */
function crearProducto(o) {
  if (!o.nombre) return err('El nombre es obligatorio.');
  const p = { id: state.seq.producto++, nombre: o.nombre.trim(), categoria: o.categoria || 'General',
    marca: (o.marca || '').trim(), iva: o.iva != null ? Number(o.iva) : 21,
    tipo: o.esGranel ? 'granel' : 'entero',
    stockMin: Number(o.stockMin) || 0, presentaciones: [],
    // Datos comerciales (se editan desde el detalle del producto: proveedores, listas de precio, presentaciones).
    proveedores: [], proveedorActivoId: null, listasPrecio: [] };
  state.productos.push(p); save(); return ok({ id: p.id });
}
function editarProducto(id, o) {
  const p = getProducto(id); if (!p) return err('Producto inexistente.');
  p.nombre = o.nombre.trim(); p.categoria = o.categoria;
  p.marca = (o.marca || '').trim();
  if (o.iva != null) p.iva = Number(o.iva);
  save(); return ok();
}
// Presentaciones de un producto a granel (se editan en el detalle). El precio de
// cada una se define por % de ganancia sobre el costo neto del proveedor activo.
function guardarPresentaciones(prodId, presentaciones) {
  const p = getProducto(prodId); if (!p) return err('Producto inexistente.');
  if (p.tipo !== 'granel') return err('Solo los productos a granel tienen presentaciones.');
  p.presentaciones = (presentaciones || [])
    .filter((x) => Number(x.tamKg) > 0)
    .map((x) => ({ id: x.id || state.seq.presentacion++, tamKg: Number(x.tamKg), ganancia: Number(x.ganancia) || 0 }));
  save(); return ok();
}
function eliminarProducto(id) {
  const total = suma({ productoId: id });
  if (total > 1e-9) return err('No se puede eliminar: el producto tiene stock. Dá de baja el stock primero.');
  state.productos = state.productos.filter((x) => x.id !== id);
  state.movimientos = state.movimientos.filter((m) => m.productoId !== id);
  save(); return ok();
}
function crearSucursal(o) { if (!o.nombre) return err('Nombre requerido.'); state.sucursales.push({ id: state.seq.sucursal++, nombre: o.nombre.trim(), tipo: o.tipo || 'express' }); save(); return ok(); }

/* ---- Proveedores (CRUD completo, datos comerciales) ---- */
function _provFields(o) {
  return { nombre: (o.nombre || '').trim(), cuit: o.cuit || '', direccion: o.direccion || '', telefono: o.telefono || '', email: o.email || '' };
}
function crearProveedor(o) {
  if (!o.nombre) return err('El nombre comercial es obligatorio.');
  state.proveedores.push(Object.assign({ id: state.seq.proveedor++ }, _provFields(o)));
  save(); return ok();
}
function editarProveedor(id, o) {
  const p = getProveedor(id); if (!p) return err('Proveedor inexistente.');
  if (!o.nombre) return err('El nombre comercial es obligatorio.');
  Object.assign(p, _provFields(o));
  save(); return ok();
}
function eliminarProveedor(id) {
  state.proveedores = state.proveedores.filter((p) => p.id !== id);
  // Limpia referencias en los productos (costos por proveedor / proveedor activo).
  state.productos.forEach((p) => {
    if (p.proveedores) {
      p.proveedores = p.proveedores.filter((e) => e.proveedorId !== id);
      if (p.proveedorActivoId === id) p.proveedorActivoId = p.proveedores[0] ? p.proveedores[0].proveedorId : null;
    }
  });
  save(); return ok();
}

/* ---- Datos comerciales del producto: proveedores (costo/desc/flete) y listas de precio ---- */
function guardarProveedoresProducto(prodId, o) {
  const p = getProducto(prodId); if (!p) return err('Producto inexistente.');
  p.proveedores = (o.proveedores || [])
    .map((e) => ({ proveedorId: Number(e.proveedorId), costo: Number(e.costo) || 0, descuento: Number(e.descuento) || 0, flete: Number(e.flete) || 0 }))
    .filter((e) => e.proveedorId);
  const act = Number(o.proveedorActivoId);
  p.proveedorActivoId = p.proveedores.find((e) => e.proveedorId === act) ? act : (p.proveedores[0] ? p.proveedores[0].proveedorId : null);
  save(); return ok();
}
function guardarListasProducto(prodId, o) {
  const p = getProducto(prodId); if (!p) return err('Producto inexistente.');
  p.listasPrecio = (o.listasPrecio || [])
    .map((l, i) => ({ id: l.id || 'L' + (i + 1), nombre: (l.nombre || '').trim() || 'Lista ' + (i + 1), ganancia: Number(l.ganancia) || 0 }))
    .filter((l) => l.nombre);
  save(); return ok();
}

/* ---- Cálculo de costo neto y precios de venta (dependen del proveedor activo) ---- */
function costoNetoEntry(e) {
  if (!e) return 0;
  const c = Number(e.costo) || 0, d = Number(e.descuento) || 0, f = Number(e.flete) || 0;
  return c * (1 - d / 100) * (1 + f / 100);
}
function proveedorActivoEntry(prod) {
  const arr = prod.proveedores || [];
  if (!arr.length) return null;
  return arr.find((e) => e.proveedorId === prod.proveedorActivoId) || arr[0];
}
function costoNeto(prod) { return costoNetoEntry(proveedorActivoEntry(prod)); }
function preciosVenta(prod) {
  const cn = costoNeto(prod);
  return (prod.listasPrecio || []).map((l) => ({ ...l, precio: cn * (1 + (Number(l.ganancia) || 0) / 100) }));
}
// Precio de referencia de la unidad base (usa la primera lista de precio; si no hay, el costo neto).
function precioBaseVenta(prod) {
  const pv = preciosVenta(prod);
  return pv.length ? pv[0].precio : costoNeto(prod);
}
// Precio de una presentación: costo neto (por kg) × tamaño × (1 + ganancia%).
function precioPresentacion(prod, presOrId) {
  const pr = typeof presOrId === 'object' ? presOrId : presDe(prod, presOrId);
  if (!pr) return 0;
  return costoNeto(prod) * (Number(pr.tamKg) || 0) * (1 + (Number(pr.ganancia) || 0) / 100);
}

/* ---------------- Contexto ---------------- */
function setCtx(k, v) { state.ctx[k] = v; save(); }

/* ---------------- Métricas / dashboard ---------------- */
// Valuación de inventario al COSTO NETO del proveedor activo (no al precio de venta).
function valorEntry(s) {
  const prod = getProducto(s.productoId); if (!prod) return 0;
  const cn = costoNeto(prod);
  if (s.presentacionId) { const pr = presDe(prod, s.presentacionId); return s.cantidad * cn * (pr ? Number(pr.tamKg) || 0 : 0); }
  return s.cantidad * cn;
}
function stockBajo() {
  return state.productos.filter((p) => {
    if (!p.stockMin) return false;
    const base = p.tipo === 'granel' ? suma({ productoId: p.id, presentacionId: null, estado: 'disponible' })
      : suma({ productoId: p.id, estado: 'disponible' });
    return base < p.stockMin;
  });
}
function incidenciasAbiertas() { return state.incidencias.filter((i) => i.estado !== 'resuelta'); }
function transferenciasPendientes() { return state.transferencias.filter((t) => t.estado !== 'recibida' && t.estado !== 'cancelada'); }

/* ---------------- Datos de ejemplo ---------------- */
function loadSeed() {
  state = nuevoEstado();
  _muted = true;
  const S = (nombre, tipo) => { const s = { id: state.seq.sucursal++, nombre, tipo }; state.sucursales.push(s); return s; };
  const P = (nombre, extra) => { const p = Object.assign({ id: state.seq.proveedor++ }, _provFields(Object.assign({ nombre }, extra || {}))); state.proveedores.push(p); return p; };
  const U = (nombre, rol) => { const u = { id: state.seq.usuario++, nombre, rol }; state.usuarios.push(u); return u; };

  const dist = S('Distribuidora', 'distribuidora');
  const ex1 = S('Express 1', 'express'), ex2 = S('Express 2', 'express'); S('Express 3', 'express');
  const molino = P('Molino Sur', { cuit: '30-71234567-9', telefono: '11-4000-0001', direccion: 'Ruta 8 km 45, Pilar', email: 'ventas@molinosur.com' });
  const legum = P('Legumbres del Norte', { cuit: '30-70011223-4', telefono: '387-500-1122', direccion: 'Av. Belgrano 250, Salta' });
  const avpampa = P('Avena Pampa', { cuit: '30-69988776-1', telefono: '2954-40-3300', direccion: 'Parque Ind. Santa Rosa' });
  const galletera = P('Galletera Rosario', { cuit: '30-71120034-7', telefono: '341-455-8899', direccion: 'Bv. Oroño 1200, Rosario' });
  const bebidas = P('Bebidas SA', { cuit: '30-70567890-2', telefono: '11-4700-2200', direccion: 'Panamericana km 32' });
  const yerbatera = P('Yerbatera Misiones', { cuit: '30-71005566-8', telefono: '3764-42-7788', direccion: 'RN 12, Apóstoles' });
  const ana = U('Ana (Admin)', 'admin'), bruno = U('Bruno (Fraccionador)', 'fraccionador'), carla = U('Carla (Vendedora)', 'vendedor');
  state.ctx.sucursalId = dist.id; state.ctx.usuarioId = ana.id;

  const mkGranel = (nombre, marca, iva) => crearProducto({ nombre, categoria: 'Alimentos', marca, iva, esGranel: true }).id;
  const mkEntero = (nombre, cat, marca, iva) => crearProducto({ nombre, categoria: cat, marca, iva, esGranel: false }).id;
  const harina = mkGranel('Harina Integral', 'Molienda del Sur', 10.5);
  const lentejas = mkGranel('Lentejas', 'Del Norte', 10.5);
  const avena = mkGranel('Avena', 'Pampa', 10.5);
  const galletitas = mkEntero('Galletitas Integrales', 'Alimentos', 'Rosario', 21);
  const gaseosa = mkEntero('Gaseosa Cola 2,25L', 'Bebidas', 'ColaCo', 21);
  const yerba = mkEntero('Yerba Orgánica 1kg', 'Alimentos', 'Selva', 21);

  // Presentaciones de los granel: precio por % de ganancia sobre el costo neto del proveedor activo.
  guardarPresentaciones(harina, [{ tamKg: 1, ganancia: 60 }, { tamKg: 0.5, ganancia: 70 }, { tamKg: 0.25, ganancia: 85 }]);
  guardarPresentaciones(lentejas, [{ tamKg: 1, ganancia: 55 }, { tamKg: 0.5, ganancia: 65 }]);
  guardarPresentaciones(avena, [{ tamKg: 1, ganancia: 50 }, { tamKg: 0.5, ganancia: 60 }]);

  // Datos comerciales (costo por proveedor + listas de precio) ANTES de las operaciones,
  // para que las ventas de ejemplo calculen precios reales.
  guardarProveedoresProducto(harina, { proveedores: [
    { proveedorId: molino.id, costo: 700, descuento: 5, flete: 3 },
    { proveedorId: legum.id, costo: 760, descuento: 0, flete: 2 },
  ], proveedorActivoId: molino.id });
  guardarListasProducto(harina, { listasPrecio: [{ nombre: 'Minorista', ganancia: 65 }, { nombre: 'Mayorista', ganancia: 30 }, { nombre: 'Oferta', ganancia: 12 }] });
  guardarProveedoresProducto(lentejas, { proveedores: [{ proveedorId: legum.id, costo: 1300, descuento: 8, flete: 4 }], proveedorActivoId: legum.id });
  guardarListasProducto(lentejas, { listasPrecio: [{ nombre: 'Minorista', ganancia: 55 }, { nombre: 'Mayorista', ganancia: 25 }] });
  guardarProveedoresProducto(galletitas, { proveedores: [{ proveedorId: galletera.id, costo: 1200, descuento: 0, flete: 5 }], proveedorActivoId: galletera.id });
  guardarListasProducto(galletitas, { listasPrecio: [{ nombre: 'Minorista', ganancia: 50 }, { nombre: 'Oferta', ganancia: 20 }] });

  const pres = (prodId, tam) => { const p = getProducto(prodId); return p.presentaciones.find((x) => Math.abs(x.tamKg - tam) < 1e-6).id; };

  // Compras (ingresan a Distribuidora)
  opCompra({ productoId: harina, sucursalId: dist.id, cantidad: 55, proveedorId: molino.id, usuarioId: ana.id });
  opCompra({ productoId: lentejas, sucursalId: dist.id, cantidad: 20, proveedorId: legum.id, usuarioId: ana.id });
  opCompra({ productoId: avena, sucursalId: dist.id, cantidad: 15, proveedorId: avpampa.id, usuarioId: ana.id });
  opCompra({ productoId: galletitas, sucursalId: dist.id, cantidad: 60, proveedorId: galletera.id, usuarioId: ana.id });
  opCompra({ productoId: gaseosa, sucursalId: dist.id, cantidad: 48, proveedorId: bebidas.id, usuarioId: ana.id });
  opCompra({ productoId: yerba, sucursalId: dist.id, cantidad: 40, proveedorId: yerbatera.id, usuarioId: ana.id });

  // Fraccionamiento (10 kg → 5×1kg + 10×500g), queda 45 kg a granel
  opFraccionar({ productoId: harina, sucursalId: dist.id, asignaciones: [{ presId: pres(harina, 1), cant: 5 }, { presId: pres(harina, 0.5), cant: 10 }], usuarioId: bruno.id });

  // Transferencia 1: Distribuidora → Express 1 (recibida)
  const t1 = crearTransferencia({ origenId: dist.id, destinoId: ex1.id, usuarioId: ana.id, items: [
    { productoId: harina, presId: pres(harina, 1), cantidad: 3 },
    { productoId: galletitas, cantidad: 12 },
  ] });
  avanzarTransferencia(t1.id); avanzarTransferencia(t1.id); avanzarTransferencia(t1.id); // pendiente→preparada→transito→recibida

  // Transferencia 2: Distribuidora → Express 2 (pendiente, granel de avena)
  crearTransferencia({ origenId: dist.id, destinoId: ex2.id, usuarioId: ana.id, items: [
    { productoId: avena, cantidad: 5 },
  ] });

  // Ventas en Distribuidora y Express 1
  opVenta({ productoId: harina, sucursalId: dist.id, cantidad: 2.5, usuarioId: carla.id });
  opVenta({ productoId: harina, sucursalId: ex1.id, presId: pres(harina, 1), cantidad: 1, usuarioId: carla.id });
  opVenta({ productoId: galletitas, sucursalId: ex1.id, cantidad: 5, usuarioId: carla.id });

  // Incidencia: bolsa rota de Avena en Distribuidora (compromete 2 kg)
  crearIncidencia({ tipo: 'Bolsa rota', productoId: avena, sucursalId: dist.id, cantidad: 2, responsableId: bruno.id, motivo: 'Bolsa dañada en depósito' });

  _muted = false; save();
}

/* ---------------- Init ---------------- */
function init() {
  if (!load() || !state.productos.length) loadSeed();
  if (state.ctx.usuarioId == null && state.usuarios[0]) state.ctx.usuarioId = state.usuarios[0].id;
  if (state.ctx.sucursalId == null && distribuidora()) state.ctx.sucursalId = distribuidora().id;
  emit();
}

export const inventoryStore = {
  get state() { return state; },
  subscribe, getVersion,
  init, save, reset: loadSeed,
  getProducto, getSucursal, getProveedor, getUsuario, presDe, distribuidora,
  unidadDe, presLabel, fmtCant, cant, suma, movimientosDe, valorEntry,
  rolActual, can, tiposMovPermitidos, setCtx,
  opCompra, opFraccionar, opVenta, opSimple,
  crearTransferencia, avanzarTransferencia, cancelarTransferencia,
  crearIncidencia, avanzarIncidencia, resolverIncidencia,
  crearProducto, editarProducto, eliminarProducto, guardarPresentaciones, crearSucursal,
  crearProveedor, editarProveedor, eliminarProveedor,
  guardarProveedoresProducto, guardarListasProducto,
  costoNeto, costoNetoEntry, proveedorActivoEntry, preciosVenta, precioBaseVenta, precioPresentacion,
  stockBajo, incidenciasAbiertas, transferenciasPendientes,
};
