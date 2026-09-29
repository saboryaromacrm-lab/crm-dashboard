/**
 * ACTUALIZAR FORMATOS DE VENTA (28/9/2026, pedido del dueño)
 * ============================================================================
 * El hermano de «Actualizar costos»: se sube el «Listado de Formatos» de
 * Ventas del sistema viejo y se actualiza SOLO el formato de venta (markup o
 * precio fijo, y de a cuántas unidades se vende). No toca costos, stock ni
 * productos. Dos modos, igual que costos:
 *
 *  · UN PROVEEDOR: el archivo filtrado por proveedor en el sistema viejo; solo
 *    se tocan los productos que en el ERP tienen a ese proveedor.
 *  · TODOS (archivo completo, 29/9/2026): el archivo NO trae la columna
 *    proveedor, así que cada producto se agrupa por el proveedor que tiene en
 *    el ERP (el que fija el precio). La vista previa se ve por proveedor y se
 *    puede excluir los que no se quieran tocar.
 *
 * Reglas fijadas con el dueño:
 *  · Se importan TODAS las listas del archivo. La que no existe en el ERP se
 *    CREA — al final del orden de preferencia (eso lo decide el servidor).
 *  · Dos listas del archivo que caen en la misma del ERP: gana la de más
 *    renglones y las otras se marcan como choque (ver `resolverChoques`).
 *  · Las listas que el producto tiene y el archivo no trae, no se tocan.
 *
 * Todo lo que es plata se calcula con `cotizar` (el espejo de pricing del
 * store), que entra por parámetro: así esto queda puro y se prueba solo.
 */
import { num, partirTamano } from './importarCatalogo.js';

/** "40.00 %" → 40. */
const pct = (v) => num(String(v ?? '').replace('%', '').trim());

const norm = (s) => String(s ?? '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/MADRE|-\s*SOLO STOCK\s*-|SOLO STOCK/g, '')
  .replace(/[^A-Z0-9Ñ ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Canal del sistema viejo → palabra con la que se busca la modalidad del ERP. */
export function modalidadDelCanal(canal, modalidades) {
  const c = norm(canal);
  const esMayor = /MAYOR|DISTRIB/.test(c);
  return (modalidades || []).find((m) => {
    const n = norm(m.nombre);
    return esMayor ? /MAYOR|DISTRIB/.test(n) : /MINOR/.test(n);
  }) || null;
}

/** Clave de una lista del archivo: canal + número, que es su identidad allá. */
export const claveLista = (canal, numero) => `${String(canal ?? '').trim()}|${String(numero ?? '').trim()}`;

/**
 * DOS LISTAS DEL ARCHIVO, UNA DEL ERP (29/9/2026, archivo completo): el
 * sistema viejo tiene "Distribución/mayorista 1" y "… 2", y las dos caen en la
 * Mayorista 1 del ERP. Sin esto ganaba la que apareciera primero en el
 * archivo — al azar. Se queda la de MÁS renglones (la que de verdad se usa);
 * las otras quedan sin importar, marcadas como choque, para que la persona
 * les elija otro destino si las quiere.
 */
export function resolverChoques(listas) {
  const porDestino = new Map();
  for (const l of listas) {
    if (l.destino.tipo !== 'existente') continue;
    const k = l.destino.listaId;
    if (!porDestino.has(k)) porDestino.set(k, []);
    porDestino.get(k).push(l);
  }
  const perdedoras = new Map();
  for (const grupo of porDestino.values()) {
    if (grupo.length < 2) continue;
    const [ganadora, ...resto] = [...grupo].sort((a, b) => b.filas - a.filas);
    for (const l of resto) perdedoras.set(l.clave, ganadora);
  }
  return listas.map((l) => {
    const g = perdedoras.get(l.clave);
    return g
      ? {
        ...l,
        choque: true,
        destino: { tipo: 'afuera', motivo: `va a la misma lista que «${g.canal} ${g.numero}», que tiene más renglones: elegile otro destino si la querés importar` },
      }
      : l;
  });
}

/**
 * LAS LISTAS DEL ARCHIVO y adónde va cada una, por defecto.
 *
 * Misma modalidad y mismo número ("Minorista 10" → Minorista 10). La única
 * excepción es la que ya fijó la importación del catálogo completo: la lista 2
 * del sistema viejo es la Mayorista del ERP, que nació como "Mayorista 1". Lo
 * que no existe se propone CREAR con ese número — y la próxima vez ya aparece
 * y se reusa sola.
 */
export function listasDelArchivo(filas, catalogo) {
  const modalidades = catalogo?.modalidades ?? [];
  const listas = (catalogo?.listas ?? []);
  const porClave = new Map();
  for (const f of filas || []) {
    const clave = claveLista(f.Canal, f.NroLista);
    if (!porClave.has(clave)) porClave.set(clave, { clave, canal: String(f.Canal ?? '').trim(), numero: Number(f.NroLista) || 0, filas: 0 });
    porClave.get(clave).filas += 1;
  }
  const resultado = [...porClave.values()]
    .sort((a, b) => b.filas - a.filas || a.numero - b.numero)
    .map((l) => {
      const mod = modalidadDelCanal(l.canal, modalidades);
      const deMod = mod ? listas.filter((x) => x.modalidadId === mod.id) : [];
      let existente = deMod.find((x) => x.numero === l.numero) || null;
      if (!existente && l.numero === 2 && mod && /MAYOR|DISTRIB/.test(norm(mod.nombre))) {
        existente = deMod.find((x) => x.numero === 1) || null;
      }
      let destino;
      if (existente && existente.activa) destino = { tipo: 'existente', listaId: existente.id };
      else if (existente) destino = { tipo: 'afuera', motivo: `la lista ${existente.etiqueta ?? existente.numero} está dada de baja` };
      else if (mod) destino = { tipo: 'nueva', modalidadId: mod.id, numero: l.numero, nombre: `lista ${l.numero} del sistema viejo` };
      else destino = { tipo: 'afuera', motivo: `no hay una modalidad para el canal «${l.canal}»` };
      return { ...l, modalidad: mod, destino };
    });
  return resolverChoques(resultado);
}

const RE_TAM_NOMBRE = /\s*X\s?[\d.,]+\s?(KG|K|GRS|GS|G)\b.*$/;

/**
 * EL ÍNDICE DEL CATÁLOGO, armado UNA vez (29/9/2026). El archivo completo trae
 * miles de renglones: buscar cada uno recorriendo el catálogo entero eran
 * decenas de millones de comparaciones. Con mapas es una búsqueda por renglón.
 */
export function indiceArticulos(productos) {
  const porCodigo = new Map();
  const porBarras = new Map();
  const porBase = new Map();
  for (const p of productos || []) {
    const c = String(p.codigoPropio ?? '').trim();
    if (c && !porCodigo.has(c)) porCodigo.set(c, p);
    const pres = p.presentaciones || [];
    for (const x of pres) {
      const b = String(x.codigoBarras ?? '').trim();
      if (b && !porBarras.has(b)) porBarras.set(b, { prod: p, pres: x });
    }
    if (pres.length) {
      const base = norm(p.nombre).replace(RE_TAM_NOMBRE, '').trim();
      if (!porBase.has(base)) porBase.set(base, []);
      porBase.get(base).push(p);
    }
  }
  return { porCodigo, porBarras, porBase };
}

/**
 * EL ARTÍCULO DE CADA RENGLÓN: el producto por su código interno; si no hay,
 * el PAQUETE fraccionado — primero por el código de barras de su etiqueta y
 * después por nombre + tamaño contra su madre ("MIX COCO NUTS X250G" → el
 * paquete de 250 g de Mix Coco Nuts), igual que lo ató el catálogo completo.
 * Acepta el catálogo o su índice (el plan pasa el índice, armado una vez).
 */
export function buscarArticulo(fila, productosOIndice) {
  const idx = Array.isArray(productosOIndice) ? indiceArticulos(productosOIndice) : productosOIndice;
  const prod = idx.porCodigo.get(String(fila.Codigo ?? '').trim());
  if (prod) return { prod, pres: null };

  const porBarras = idx.porBarras.get(String(fila.CodBar ?? '').trim());
  if (porBarras) return porBarras;

  const t = partirTamano(String(fila.Producto ?? ''));
  if (t) {
    for (const p of idx.porBase.get(norm(t.base)) || []) {
      const pres = p.presentaciones.find((x) => Math.abs((Number(x.tamKg) || 0) - t.kg) < 1e-6);
      if (pres) return { prod: p, pres };
    }
  }
  return null;
}

/** El renglón del archivo hecho fila de formato de venta del ERP. */
export function filaDelArchivo(f) {
  const precioDefinido = /PRECIO/i.test(String(f.Actualizacion__ ?? ''));
  const unidades = Math.max(1, num(f.Cantidad) || 1);
  return precioDefinido
    ? { modoPrecio: 'precio', markup: 0, precioFijo: num(f.PrecioTotal__), unidades }
    : { modoPrecio: 'markup', markup: pct(f.MarkUp__), precioFijo: 0, unidades };
}

const mismaFila = (a, b) => a && b
  && a.modoPrecio === b.modoPrecio
  && Math.abs((Number(a.unidades) || 1) - (Number(b.unidades) || 1)) < 1e-9
  && (a.modoPrecio === 'precio'
    ? Math.abs((Number(a.precioFijo) || 0) - (Number(b.precioFijo) || 0)) < 0.005
    : Math.abs((Number(a.markup) || 0) - (Number(b.markup) || 0)) < 0.005);

export const ESTADOS_FV = {
  cambia: 'Cambia',
  agrega: 'Se agrega la lista',
  igual: 'Sin cambios',
};

/**
 * EL PLAN: qué pasa con cada renglón, antes de tocar nada.
 *
 * `destinos`: clave de lista del archivo → destino elegido en pantalla (ver
 * `listasDelArchivo`). `esDelProveedor(prod)`: el filtro por proveedor (null =
 * archivo completo, no se filtra). `proveedorDe(prod)` → {id, nombre} o null:
 * con quién se agrupa cada renglón. `cotizar(prod, pres, fila)` → precio final.
 */
export function armarPlanFormatosVenta(filas, {
  productos, destinos, esDelProveedor = null, proveedorDe = () => null, cotizar = () => null,
}) {
  const idx = indiceArticulos(productos);
  const items = [];
  const afuera = [];
  const vistos = new Set();

  for (const f of filas || []) {
    const codigo = String(f.Codigo ?? '').trim();
    const nombreArchivo = String(f.Producto ?? '').trim();
    const clave = claveLista(f.Canal, f.NroLista);
    const etiquetaArchivo = `${String(f.Canal ?? '').trim()} ${String(f.NroLista ?? '').trim()}`;
    const fuera = (motivo, extra = {}) => afuera.push({ codigo, nombre: nombreArchivo, lista: etiquetaArchivo, motivo, ...extra });

    const destino = destinos[clave];
    if (!destino || destino.tipo === 'afuera') { fuera(destino?.motivo || 'la lista no se importa'); continue; }

    const nueva = filaDelArchivo(f);
    if (nueva.modoPrecio === 'precio' && !(nueva.precioFijo > 0)) {
      fuera(/SOLO STOCK|MADRE/i.test(nombreArchivo)
        ? 'producto madre con precio $0 en el sistema viejo: no se vende suelto'
        : 'precio definido en $0: dejaría el producto a precio cero');
      continue;
    }
    if (nueva.modoPrecio === 'markup' && !Number.isFinite(nueva.markup)) { fuera('markup ilegible'); continue; }

    const art = buscarArticulo(f, idx);
    if (!art) { fuera('no hay en el ERP un producto ni un paquete con este código'); continue; }
    const { prod, pres } = art;
    const nombre = pres ? `${prod.nombre} · paquete ${pres.tamKg >= 1 ? `${pres.tamKg} kg` : `${Math.round(pres.tamKg * 1000)} g`}` : prod.nombre;
    if (prod.estado === 'archivado') { fuera('está archivado', { nombre }); continue; }
    if (esDelProveedor && !esDelProveedor(prod)) { fuera('en el ERP no tiene a este proveedor en su formato de compra', { nombre }); continue; }

    const ambito = `${prod.id}:${pres?.id ?? ''}`;
    // Por la lista DESTINO, no la del archivo: si dos listas del archivo van a
    // parar a la misma del ERP, la segunda pisaría a la primera en silencio.
    const claveItem = `${ambito}|${destino.tipo === 'existente' ? `L${destino.listaId}` : `N${clave}`}`;
    if (vistos.has(claveItem)) { fuera('otra fila del archivo ya carga esta lista para este producto', { nombre }); continue; }
    vistos.add(claveItem);

    const actuales = (pres ? pres.listas : prod.listas) || [];
    const actual = destino.tipo === 'existente' ? actuales.find((l) => l.listaId === destino.listaId) || null : null;
    const estado = !actual ? 'agrega' : (mismaFila(actual, nueva) ? 'igual' : 'cambia');
    const prov = proveedorDe(prod);

    items.push({
      codigo,
      nombre,
      productoId: prod.id,
      presentacionId: pres?.id ?? null,
      proveedorId: prov?.id ?? 0,
      proveedor: prov?.nombre ?? 'Sin proveedor en el ERP',
      clave,
      listaArchivo: etiquetaArchivo,
      destino,
      estado,
      antes: actual ? { modoPrecio: actual.modoPrecio, markup: Number(actual.markup) || 0, precioFijo: Number(actual.precioFijo) || 0, unidades: Number(actual.unidades) || 1 } : null,
      despues: nueva,
      precioAntes: actual ? cotizar(prod, pres, actual) : null,
      precioDespues: cotizar(prod, pres, nueva),
      precioSistemaViejo: num(f.PrecioTotal__) || null,
    });
  }

  const resumen = { cambia: 0, agrega: 0, igual: 0, afuera: afuera.length };
  for (const i of items) resumen[i.estado] += 1;
  return { items, afuera, resumen };
}

/** El plan agrupado por proveedor (archivo completo): qué cambia de cada uno. */
export function resumenPorProveedor(plan) {
  const m = new Map();
  for (const i of plan.items) {
    if (!m.has(i.proveedorId)) m.set(i.proveedorId, { id: i.proveedorId, nombre: i.proveedor, cambia: 0, agrega: 0, igual: 0 });
    m.get(i.proveedorId)[i.estado] += 1;
  }
  return [...m.values()].sort((a, b) => (b.cambia + b.agrega) - (a.cambia + a.agrega) || String(a.nombre).localeCompare(String(b.nombre)));
}

/**
 * Lo que viaja al servidor: solo lo que cambia o se agrega, con la lista ya
 * resuelta — `listaId` si existe, `listaNueva` (su clave) si hay que crearla.
 * `excluidos`: proveedores que la persona sacó de la importación completa.
 */
export function cuerpoImportacion(plan, listas, proveedorId, { excluidos = new Set() } = {}) {
  const aEnviar = plan.items.filter((i) => i.estado !== 'igual' && !excluidos.has(i.proveedorId));
  const clavesNuevas = new Set(aEnviar.filter((i) => i.destino.tipo === 'nueva').map((i) => i.clave));
  return {
    ...(proveedorId ? { proveedorId } : { todos: true }),
    listasNuevas: listas
      .filter((l) => clavesNuevas.has(l.clave))
      .map((l) => ({ clave: l.clave, modalidadId: l.destino.modalidadId, numero: l.destino.numero, nombre: l.destino.nombre })),
    items: aEnviar.map((i) => ({
      productoId: i.productoId,
      presentacionId: i.presentacionId,
      ...(i.destino.tipo === 'existente' ? { listaId: i.destino.listaId } : { listaNueva: i.clave }),
      modoPrecio: i.despues.modoPrecio,
      markup: i.despues.markup,
      precioFijo: i.despues.precioFijo,
      unidades: i.despues.unidades,
      codigo: i.codigo,
    })),
  };
}
