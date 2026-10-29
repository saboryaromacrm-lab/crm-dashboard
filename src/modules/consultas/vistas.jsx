/**
 * CONSULTAS RÁPIDAS — las vistas (filtros + grilla)
 * ============================================================================
 * Dos consultas transversales: **cambios de precio** y **existencias**. No son
 * de un módulo en particular — se preguntan desde donde uno esté, con el
 * cliente enfrente — así que viven acá y las usan tanto los modales globales
 * (Alt+F5 / Alt+F3) como los paneles del menú.
 *
 * Son AUTOSUFICIENTES a propósito: piden sus propios datos y no dependen del
 * contexto de Ventas. Si dependieran, el atajo solo andaría dentro de Ventas,
 * que es exactamente el bug que las trajo hasta acá.
 *
 * LAYOUT: tres franjas fijas (filtros / grilla con scroll / pie). Los filtros y
 * la cabecera no se van nunca de la vista, que es lo que permite recorrer
 * doscientas filas sin perder de vista qué columna es cuál.
 *
 * Todo se trae UNA vez y los filtros corren en memoria: cada tecla filtra al
 * instante, sin un viaje a la red por pulsación.
 */
import { useEffect, useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num, fmtFechaHora } from '@modules/productos/domain/format.js';
import { labelTipoMov } from '@modules/productos/domain/constants.js';
import { usePaginado, Paginador } from '@modules/productos/components/ui.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { PERMISO_FICHA } from './DetalleDesdeConsulta.jsx';
import c from './Consultas.module.css';

/** Texto comparable: sin acentos ni mayúsculas. */
const norm = (v) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const ORIGEN_PRECIO = {
  inicial: 'Alta',
  costo: 'Cambio de costo',
  formato_compra: 'Formato de compra',
  formato_venta: 'Formato de venta',
  activacion: 'Cambio de formato activo',
  reversion: 'Reversión',
};

/* ------------------------------------------------------------------ *
 * Piezas comunes
 * ------------------------------------------------------------------ */

function Campo({ label, ancho, children }) {
  return (
    <div className={cx(c.campo, ancho === 'buscador' && c.buscador)}>
      <label>{label}</label>
      {children}
    </div>
  );
}

/**
 * Barra de estado: cuántos resultados de cuántos, y el botón de limpiar que
 * aparece SOLO cuando hay algo que limpiar — un botón permanente que la mitad
 * del tiempo no hace nada es ruido.
 */
function BarraEstado({ visibles, total, cargando, hayFiltro, onLimpiar, extra }) {
  return (
    <div className={c.estado}>
      <span className={c.conteo}>
        {cargando
          ? 'Cargando…'
          : <><strong>{visibles}</strong>{visibles !== total && <> de {total}</>} {total === 1 ? 'resultado' : 'resultados'}</>}
        {extra && !cargando && <> · {extra}</>}
      </span>
      {hayFiltro && (
        <button type="button" className={c.limpiar} onClick={onLimpiar}>Limpiar filtros</button>
      )}
    </div>
  );
}

/**
 * Cabecera de dos niveles: fila de grupos + fila de columnas. Una columna con
 * `onClick` se puede ordenar (`orden`: 'desc' | 'asc' | null).
 */
function Cabecera({ grupos, columnas }) {
  return (
    <thead>
      <tr className={c.grupoFila}>
        {grupos.map((g, i) => (
          <th key={i} colSpan={g.span} className={cx(i > 0 && c.grupo)}>{g.h}</th>
        ))}
      </tr>
      <tr className={c.colFila}>
        {columnas.map((col, i) => (
          <th
            key={i}
            className={cx(col.num && c.num, col.grupo && c.grupo, col.cls && c[col.cls], col.onClick && c.ordenable, col.orden && c.colActiva)}
            onClick={col.onClick}
            title={col.titulo}
            aria-sort={col.orden ? (col.orden === 'desc' ? 'descending' : 'ascending') : undefined}
          >
            {col.h}{col.orden ? (col.orden === 'desc' ? ' ▼' : ' ▲') : ''}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/* ------------------------------------------------------------------ *
 * Cambios de precio  (Alt+F5)
 * ------------------------------------------------------------------ */

function Variacion({ valor }) {
  if (valor == null) return <span className={c.alta}>alta</span>;
  const sube = valor > 0;
  return (
    <span className={cx(c.variacion, sube ? c.sube : c.baja)}>
      {sube ? '▲' : '▼'}{num(Math.abs(valor), 2)}%
    </span>
  );
}

const FILTROS_PRECIO = { q: '', marca: '', lista: '', origen: '', desde: '' };

export function CambiosPrecioVista({ compacto = false }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(FILTROS_PRECIO);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    let vivo = true;
    httpClient.get('/precios/evolucion?limit=2000')
      .then((r) => { if (vivo) setFilas(r); })
      .catch((e) => { if (vivo) { setError(e?.message || 'No se pudo cargar.'); setFilas([]); } });
    return () => { vivo = false; };
  }, []);

  // Las opciones salen de lo que de verdad hay: no se ofrece un filtro vacío.
  const marcas = useMemo(() => [...new Set((filas ?? []).map((x) => x.marca).filter(Boolean))].sort(), [filas]);
  const listas = useMemo(() => [...new Set((filas ?? []).map((x) => x.lista))].sort(), [filas]);
  const origenes = useMemo(() => [...new Set((filas ?? []).map((x) => x.origen))], [filas]);

  const visibles = useMemo(() => {
    const n = norm(f.q);
    const corte = f.desde ? new Date(f.desde).getTime() : null;
    return (filas ?? []).filter((x) => (
      (!n || norm(x.producto).includes(n) || (x.codigo ?? '').includes(f.q) || (x.codigoPropio ?? '').includes(f.q))
      && (!f.marca || x.marca === f.marca)
      && (!f.lista || x.lista === f.lista)
      && (!f.origen || x.origen === f.origen)
      && (!corte || new Date(x.fecha).getTime() >= corte)
    ));
  }, [filas, f]);

  /** Cuántos subieron y cuántos bajaron: el resumen que se busca de un vistazo. */
  const resumen = useMemo(() => {
    const suben = visibles.filter((x) => x.variacion > 0).length;
    const bajan = visibles.filter((x) => x.variacion < 0).length;
    return suben || bajan ? `${suben} ↑ · ${bajan} ↓` : null;
  }, [visibles]);

  const hayFiltro = Object.keys(FILTROS_PRECIO).some((k) => f[k] !== FILTROS_PRECIO[k]);
  const pag = usePaginado(visibles, 'consultaPrecios', JSON.stringify(f));

  return (
    <div className={c.consulta}>
      <div className={c.filtros} style={{ gridTemplateColumns: '2.2fr 1fr 1.3fr 1.2fr 1fr' }}>
        <Campo label="Buscar producto o código" ancho="buscador">
          <input
            autoFocus={compacto}
            value={f.q}
            placeholder="Nombre, código de barras o código propio…"
            onChange={(e) => set({ q: e.target.value })}
          />
        </Campo>
        <Campo label="Marca">
          <select value={f.marca} onChange={(e) => set({ marca: e.target.value })}>
            <option value="">Todas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Lista">
          <select value={f.lista} onChange={(e) => set({ lista: e.target.value })}>
            <option value="">Todas</option>
            {listas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Motivo">
          <select value={f.origen} onChange={(e) => set({ origen: e.target.value })}>
            <option value="">Todos</option>
            {origenes.map((o) => <option key={o} value={o}>{ORIGEN_PRECIO[o] || o}</option>)}
          </select>
        </Campo>
        <Campo label="Desde">
          <input type="date" value={f.desde} onChange={(e) => set({ desde: e.target.value })} />
        </Campo>
      </div>

      <BarraEstado
        visibles={visibles.length}
        total={(filas ?? []).length}
        cargando={filas === null}
        hayFiltro={hayFiltro}
        onLimpiar={() => setF(FILTROS_PRECIO)}
        extra={resumen}
      />

      <div className={c.scroll}>
        <table className={c.tabla}>
          {/*
            SIN LA COLUMNA "MOTIVO" (15/8/2026, pedido del dueño). Decía de dónde
            salió el cambio —"Cambio de costo · Recepción de comprobante"— y era
            la columna más ancha de la tabla para un dato que en la práctica se
            mira poco: el 90% de los cambios vienen del mismo lado.
            Y con eso muere el grupo "Origen", que agrupaba Motivo + Fecha: un
            encabezado de grupo sobre una sola columna es ruido que no agrupa
            nada. La FECHA se queda —en un historial es lo que más se mira— y el
            filtro por Motivo sigue arriba, que es donde de verdad sirve: para
            acotar la lista, no para leerlo renglón por renglón.
          */}
          <Cabecera
            grupos={[{ h: 'Producto', span: 2 }, { h: 'Precio de góndola', span: 3 }, { h: '', span: 1 }]}
            columnas={[
              { h: 'Producto' }, { h: 'Lista' },
              { h: 'Antes', num: true, grupo: true }, { h: 'Después', num: true }, { h: 'Variación', num: true },
              { h: 'Fecha', grupo: true },
            ]}
          />
          <tbody>
            {error && (
              <tr><td colSpan={6} className={c.vacio}>{error}</td></tr>
            )}
            {!error && filas === null && (
              <tr><td colSpan={6} className={c.vacio}>Cargando…</td></tr>
            )}
            {!error && filas !== null && visibles.length === 0 && (
              <tr>
                <td colSpan={6} className={c.vacio}>
                  {(filas ?? []).length === 0
                    ? 'Todavía no hay cambios de precio registrados.'
                    : 'Nada coincide con esos filtros.'}
                </td>
              </tr>
            )}
            {pag.visibles.map((x) => (
              <tr key={x.id}>
                <td>
                  <div className={c.prodNombre}>{x.producto}</div>
                  <div className={c.prodMeta}>
                    {x.marca || 'Sin marca'}{(x.codigoPropio || x.codigo) && ` · ${x.codigoPropio || x.codigo}`}
                  </div>
                </td>
                <td>{x.lista}</td>
                <td className={cx(c.num, c.mono, c.grupo, c.antes)}>
                  {x.precioAnterior != null ? money(x.precioAnterior) : '—'}
                </td>
                <td className={cx(c.num, c.mono, c.precioBase)}>{money(x.precio)}</td>
                <td className={c.num}><Variacion valor={x.variacion} /></td>
                {/* El motivo no se muestra pero SÍ se sigue leyendo: va en el
                    title de la fecha, para el día que haga falta uno puntual
                    sin volver a agrandar la tabla. */}
                <td
                  className={cx(c.mono, c.grupo)}
                  style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                  title={[ORIGEN_PRECIO[x.origen] || x.origen, x.detalle].filter(Boolean).join(' · ')}
                >
                  {fmtFechaHora(x.fecha)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginador pag={pag} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Existencias  (Alt+F3)
 * ------------------------------------------------------------------ */

const FILTROS_STOCK = { q: '', proveedor: '', categoria: '', marca: '', soloConStock: false, faltaEn: '', pedido: '', nuncaTuvo: false };
const totalDe = (i) => (i.stockSucursales ?? []).reduce((a, x) => a + (x.cantidad || 0), 0);
const stockEn = (item, sucursalId) => item.stockSucursales?.find((x) => x.sucursalId === sucursalId)?.cantidad ?? 0;
/** El stock de la columna por la que se ordena: una sucursal o 'total'. */
const stockDeColumna = (item, col) => (col === 'total' ? totalDe(item) : stockEn(item, col));

/*
 * SIN STOCK DESDE CUÁNDO (29/10/2026, pedido del dueño: «quiero ver desde
 * cuándo están sin stock en los express; controlo que tengan completos sus
 * estantes y que siempre hagan el pedido»). La API (`/movimientos/sin-stock-
 * desde`) dice, de cada artículo en 0 en cada local, el día que se quedó sin
 * stock, si el número es confiable y el último pedido que lo trajo después.
 * Acá se muestra debajo de cada 0, y el filtro «Faltan en» lista lo que un
 * local tiene en 0 mientras la Distribuidora tiene: lo que podían pedir.
 */
const claveSin = (productoId, presentacionId, sucursalId) => `${productoId}|${presentacionId ?? 0}|${sucursalId}`;
/** Días de calendario desde una fecha hasta hoy. */
function diasDesde(iso) {
  const d = new Date(iso), h = new Date();
  return Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
}
const haceTexto = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} d`);
const ddmm = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
const ESTADO_PEDIDO = { borrador: 'sin enviar', pendiente: 'sin preparar', preparada: 'en preparación', transito: 'en camino', recibida: 'recibido' };
/** Llegó (o salió) sin nada de ese artículo: el origen no lo tenía. */
const pedidoVacio = (p) => (p.estado === 'recibida' ? !(p.recibido > 0) : p.estado === 'transito' && !(p.preparado > 0));

/**
 * Lo que va debajo de un 0: desde cuándo y, en un express, si lo pidieron. Lo
 * que el local NUNCA TUVO (casi siempre, algo que no trabaja) no dice nada salvo
 * que se pida (`mostrarNunca`): escrito en cada celda, tapaba lo que importa.
 */
function SinStockDetalle({ info, registroDesde, mostrarPedido, mostrarNunca, enDistribuidora, distNombre, prodTipo }) {
  const p = info?.pedido;
  if (!info?.desde && !(mostrarPedido && p) && !mostrarNunca) return null;
  const linea1 = info?.desde
    ? <span className={cx(c.hace, info.contar && c.contar)}>{haceTexto(diasDesde(info.desde))}{info.contar ? ' · contar' : ''}</span>
    : mostrarNunca && <span className={c.hace}>nunca tuvo</span>;
  let linea2 = null;
  if (mostrarPedido && p) {
    const vacio = pedidoVacio(p);
    linea2 = <span className={cx(c.pedido, vacio ? c.sinPedir : c.pedidoOk)}>{p.estado === 'borrador' ? 'sin enviar' : vacio ? 'no se mandó' : `pedido ${ddmm(p.fecha)}`}</span>;
  } else if (mostrarPedido && enDistribuidora > 0 && (info?.desde || mostrarNunca)) {
    linea2 = <span className={cx(c.pedido, c.sinPedir)}>sin pedir</span>;
  }
  const partes = [];
  if (info?.desde) {
    const cuando = `${fmtFechaHora(info.desde)} (${labelTipoMov(info.tipo, prodTipo).toLowerCase()})`;
    partes.push(info.contar
      ? `En 0 en el sistema desde el ${cuando}, pero se vendió sin stock cargado: el número no es confiable. Hay que contarlo.`
      : `Sin stock desde el ${cuando}.`);
  } else {
    partes.push(`Nunca tuvo stock acá desde que se usa el sistema${registroDesde ? ` (${ddmm(registroDesde)})` : ''}.`);
  }
  if (mostrarPedido && p) {
    partes.push(p.estado === 'borrador'
      ? `Está en el pedido que se está armando (${p.pedido} u.), todavía sin enviar.`
      : `Pedido ${p.codigo} del ${ddmm(p.fecha)}: ${ESTADO_PEDIDO[p.estado] ?? p.estado}. Pidió ${p.pedido}, prepararon ${p.preparado}${p.recibido != null ? `, recibió ${p.recibido}` : ''}.`);
  } else if (mostrarPedido && enDistribuidora > 0) {
    partes.push(`No se pidió desde entonces, y en ${distNombre} hay ${num(enDistribuidora)}.`);
  }
  return (
    <span className={c.sinDetalle} title={partes.join(' ')}>
      {linea1}
      {linea2}
    </span>
  );
}

export function ExistenciasVista({ compacto = false, onAbrirFicha = null }) {
  /*
   * Abrir la ficha muestra costos y margenes, asi que pide la misma llave que
   * Compras > Productos. Sin ella la consulta sigue siendo lo que era —stock y
   * precios de venta— y las filas ni se ofrecen como clicables.
   */
  const { can } = usePermissions();
  const puedeVerFicha = !!onAbrirFicha && can(PERMISO_FICHA);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(FILTROS_STOCK);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  /*
   * ORDENAR POR EL STOCK DE UNA SUCURSAL (12/10/2026, pedido del dueño): clic
   * en su nombre = de mayor a menor; otro clic = de menor a mayor; el tercero
   * vuelve al orden de siempre. La columna elegida queda resaltada.
   */
  const [orden, setOrden] = useState({ col: null, dir: 'desc' });
  const ordenarPor = (col) => setOrden((o) => (o.col !== col ? { col, dir: 'desc' } : o.dir === 'desc' ? { col, dir: 'asc' } : { col: null, dir: 'desc' }));
  const ordenDe = (col) => (orden.col === col ? orden.dir : null);

  /* Desde cuándo está en 0 cada artículo (29/10/2026). Va aparte y no frena la
   * consulta: si no llega, la grilla se ve como siempre. */
  const [sin, setSin] = useState(null);
  const [dist, setDist] = useState(null);

  useEffect(() => {
    let vivo = true;
    httpClient.get('/movimientos/sin-stock-desde')
      .then((r) => { if (vivo) setSin({ registroDesde: r.registroDesde, porClave: new Map((r.items ?? []).map((x) => [claveSin(x.productoId, x.presentacionId, x.sucursalId), x])) }); })
      .catch(() => {});
    // La sucursal se pide solo para tener un id válido con el que pedir el
    // catálogo; las COLUMNAS salen de `stockSucursales`, que ya trae todas las
    // sucursales con su nombre para cada artículo. De acá sale también cuál es
    // la Distribuidora, de donde se surten los express.
    httpClient.get('/sucursales')
      .then((sucs) => {
        if (!vivo) return null;
        const d = (sucs ?? []).find((x) => x.tipo === 'distribuidora');
        setDist(d ? { id: d.id, nombre: d.nombre } : null);
        if (!sucs?.length) { setDatos({ items: [], sucursales: [], listas: new Map(), baseId: null, proveedores: [] }); return null; }
        return httpClient.get(`/ventas/catalogo?sucursalId=${sucs[0].id}`);
      })
      .then((cat) => {
        if (!vivo || !cat) return;
        const items = cat.items ?? [];
        setDatos({
          items,
          sucursales: items[0]?.stockSucursales?.map((x) => ({ id: x.sucursalId, nombre: x.nombre })) ?? [],
          listas: new Map((cat.listas ?? []).map((l) => [l.listaId, l.etiqueta])),
          baseId: (cat.listas ?? []).find((l) => l.esBase)?.listaId ?? null,
          proveedores: cat.proveedoresCatalogo ?? [],
        });
      })
      .catch((e) => { if (vivo) { setError(e?.message || 'No se pudo cargar.'); setDatos({ items: [], sucursales: [], listas: new Map(), baseId: null, proveedores: [] }); } });
    return () => { vivo = false; };
  }, []);

  const { items = [], sucursales = [], listas = new Map(), baseId = null, proveedores = [] } = datos ?? {};

  const marcas = useMemo(() => [...new Set(items.map((i) => i.marca).filter(Boolean))].sort(), [items]);
  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria).filter(Boolean))].sort(), [items]);

  /* FALTAN EN (29/10/2026): lo que ese local tiene en 0 o menos y la Distribuidora tiene. */
  const faltaEn = f.faltaEn && dist ? Number(f.faltaEn) : null;
  const infoDe = (i, sucId) => sin?.porClave.get(claveSin(i.productoId, i.presentacionId, sucId)) ?? null;

  const visibles = useMemo(() => {
    const n = norm(f.q);
    const prov = f.proveedor ? Number(f.proveedor) : null;
    const filtrados = items.filter((i) => (
      (!n || norm(i.nombre).includes(n) || (i.codigoBarras ?? '').includes(f.q) || (i.codigo ?? '').includes(f.q))
      && (!prov || (i.proveedorIds ?? []).includes(prov))
      && (!f.marca || i.marca === f.marca)
      && (!f.categoria || i.categoria === f.categoria)
      && (!f.soloConStock || totalDe(i) > 0)
      && (!faltaEn || (stockEn(i, faltaEn) <= 1e-9 && stockEn(i, dist.id) > 1e-9))
      /* Lo que el local nunca tuvo (no lo trabaja) queda afuera salvo que se pida: si no, tapa lo que se le terminó. */
      && (!faltaEn || !sin || f.nuncaTuvo || !!infoDe(i, faltaEn)?.desde)
      && (!faltaEn || !f.pedido || (f.pedido === 'con') === !!infoDe(i, faltaEn)?.pedido)
    ));
    /* Con «Faltan en» y sin columna elegida: primero el estante vacío de verdad (lo que hace más que falta
     * arriba), después lo que hay que contar y al final lo que nunca tuvo. */
    if (orden.col == null && faltaEn) {
      const peso = (i) => { const x = infoDe(i, faltaEn); return x?.desde ? [x.contar ? 1 : 0, new Date(x.desde).getTime()] : [2, 0]; };
      return filtrados
        .map((i) => [peso(i), i])
        .sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[1].nombre.localeCompare(b[1].nombre, 'es'))
        .map(([, i]) => i);
    }
    if (orden.col == null) return filtrados;
    const signo = orden.dir === 'desc' ? -1 : 1;
    return filtrados
      .map((i) => [stockDeColumna(i, orden.col), i])
      .sort((a, b) => (a[0] - b[0]) * signo || a[1].nombre.localeCompare(b[1].nombre, 'es'))
      .map(([, i]) => i);
  }, [items, f, orden, faltaEn, dist, sin]);
  /* Con una columna elegida (12/10/2026, pedido del dueño): de lo que se ve, cuántos tienen stock (más de 0) ahí. */
  const conStock = useMemo(
    () => (orden.col == null ? 0 : visibles.filter((i) => stockDeColumna(i, orden.col) > 1e-9).length),
    [visibles, orden.col],
  );
  /* Con «Faltan en»: de lo que se ve, cuántos no se pidieron y cuántos hay que contar. */
  const resumenFalta = useMemo(() => {
    if (!faltaEn || !sin) return null;
    const infos = visibles.map((i) => infoDe(i, faltaEn));
    return { sinPedir: infos.filter((x) => !x?.pedido).length, contar: infos.filter((x) => x?.contar).length };
  }, [visibles, faltaEn, sin]);
  const expresses = sucursales.filter((su) => su.id !== dist?.id);
  const extraEstado = [
    resumenFalta && <span key="f"><strong>{resumenFalta.sinPedir}</strong> sin pedir</span>,
    resumenFalta?.contar > 0 && <span key="c"><strong>{resumenFalta.contar}</strong> para contar</span>,
    orden.col != null && <span key="o"><strong>{conStock}</strong> con stock {orden.col === 'total' ? 'en total' : `en ${sucursales.find((x) => x.id === orden.col)?.nombre ?? ''}`}</span>,
  ].filter(Boolean);

  const hayFiltro = Object.keys(FILTROS_STOCK).some((k) => f[k] !== FILTROS_STOCK[k]);
  const pag = usePaginado(visibles, 'consultaExistencias', JSON.stringify([f, orden]));
  const nCols = 2 + sucursales.length + 2 + 1;

  return (
    <div className={c.consulta}>
      <div className={c.filtros} style={{ gridTemplateColumns: dist ? '2fr 1.2fr 1fr 1fr 1.1fr 1fr auto' : '2.2fr 1.3fr 1.2fr 1.2fr auto' }}>
        <Campo label="Buscar producto o código" ancho="buscador">
          <input
            autoFocus={compacto}
            value={f.q}
            placeholder="Escaneá un código o escribí el nombre…"
            onChange={(e) => set({ q: e.target.value })}
          />
        </Campo>
        <Campo label="Proveedor">
          <select value={f.proveedor} onChange={(e) => set({ proveedor: e.target.value })}>
            <option value="">Todos</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Categoría">
          <select value={f.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            <option value="">Todas</option>
            {categorias.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Marca">
          <select value={f.marca} onChange={(e) => set({ marca: e.target.value })}>
            <option value="">Todas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        {dist && (
          <>
            <Campo label={`Faltan en (y hay en ${dist.nombre})`}>
              <select id="consulta-falta-en" value={f.faltaEn} onChange={(e) => set({ faltaEn: e.target.value, ...(e.target.value ? {} : { pedido: '', nuncaTuvo: false }) })}>
                <option value="">—</option>
                {expresses.map((su) => <option key={su.id} value={su.id}>{su.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Pedido">
              <select
                id="consulta-pedido" value={f.pedido} onChange={(e) => set({ pedido: e.target.value })}
                disabled={!faltaEn} title={faltaEn ? undefined : 'Elegí primero en qué local faltan'}
              >
                <option value="">Pedidos y sin pedir</option>
                <option value="sin">Solo sin pedir</option>
                <option value="con">Solo pedidos</option>
              </select>
            </Campo>
          </>
        )}
        <Campo label="Stock">
          {/* Con «Faltan en», «Solo con stock» no dice nada (la Distribuidora siempre tiene): se ofrece sumar lo que nunca tuvo. */}
          {faltaEn ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', padding: '7px 0' }} title="Lo que ese local nunca tuvo desde que se usa el sistema: en general, lo que no trabaja">
              <input
                id="consulta-nunca-tuvo"
                type="checkbox"
                checked={!!f.nuncaTuvo}
                onChange={(e) => set({ nuncaTuvo: e.target.checked })}
              />
              Incluir lo que nunca tuvo
            </label>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap', padding: '7px 0' }}>
              <input
                type="checkbox"
                checked={f.soloConStock}
                onChange={(e) => set({ soloConStock: e.target.checked })}
              />
              Solo con stock
            </label>
          )}
        </Campo>
      </div>

      <BarraEstado
        visibles={visibles.length}
        total={items.length}
        cargando={datos === null}
        hayFiltro={hayFiltro}
        onLimpiar={() => setF(FILTROS_STOCK)}
        extra={extraEstado.length > 0 && extraEstado.map((x, k) => <span key={k}>{k > 0 && ' · '}{x}</span>)}
      />

      <div className={c.scroll}>
        <table className={c.tabla}>
          <Cabecera
            grupos={[
              { h: 'Producto', span: 2 },
              { h: 'Stock por sucursal', span: sucursales.length + 1 },
              { h: 'Precios', span: 2 },
            ]}
            columnas={[
              { h: 'Código' }, { h: 'Producto' },
              ...sucursales.map((su, i) => ({
                h: su.nombre, num: true, grupo: i === 0,
                onClick: () => ordenarPor(su.id), orden: ordenDe(su.id), titulo: `Ordenar por el stock de ${su.nombre}`,
              })),
              { h: 'Total', num: true, cls: 'totalCol', onClick: () => ordenarPor('total'), orden: ordenDe('total'), titulo: 'Ordenar por el stock total' },
              { h: 'Mostrador', num: true, grupo: true }, { h: 'Otras listas' },
            ]}
          />
          <tbody>
            {error && <tr><td colSpan={nCols} className={c.vacio}>{error}</td></tr>}
            {!error && datos === null && (
              <tr><td colSpan={nCols} className={c.vacio}>Cargando…</td></tr>
            )}
            {!error && datos !== null && visibles.length === 0 && (
              <tr><td colSpan={nCols} className={c.vacio}>Nada coincide con esos filtros.</td></tr>
            )}
            {pag.visibles.map((i) => {
              const total = totalDe(i);
              const otras = (i.precios ?? []).filter((p) => p.listaId !== baseId);
              /* La ficha es del PRODUCTO: un paquete fraccionado abre la de su
                 madre, que es donde estan sus formatos y su costo. */
              const abrir = puedeVerFicha ? () => onAbrirFicha(i.productoId) : null;
              return (
                <tr
                  key={i.key}
                  className={cx(abrir && c.filaClicable)}
                  onClick={abrir ?? undefined}
                  /* Con teclado: Tab llega a la fila y Enter o Espacio la abre.
                     Sin esto, quien no usa mouse no tendria como entrar. */
                  tabIndex={abrir ? 0 : undefined}
                  role={abrir ? 'button' : undefined}
                  title={abrir ? 'Ver la ficha del producto' : undefined}
                  onKeyDown={abrir ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
                  } : undefined}
                >
                  <td className={c.mono} style={{ fontSize: 12 }}>{i.codigo || '—'}</td>
                  <td>
                    <div className={c.prodNombre}>{i.nombre}</div>
                    <div className={c.prodMeta}>{i.detalle} · {i.marca || 'Sin marca'}</div>
                  </td>
                  {sucursales.map((su, idx) => {
                    const q = stockEn(i, su.id);
                    const falta = q <= 1e-9;
                    return (
                      // El cero se atenúa: lo que HAY tiene que saltar a la vista.
                      <td
                        key={su.id}
                        className={cx(c.num, c.mono, idx === 0 && c.grupo, orden.col === su.id && c.colActiva, faltaEn === su.id && c.colFalta)}
                      >
                        <span className={cx(falta && c.cero)}>{num(q)}{i.unidad === 'kg' ? ' kg' : ''}</span>
                        {/* Debajo del 0: desde cuándo y, en un express, si lo pidieron (29/10/2026). */}
                        {falta && sin && (
                          <SinStockDetalle
                            info={infoDe(i, su.id)}
                            registroDesde={sin.registroDesde}
                            mostrarPedido={!!dist && su.id !== dist.id}
                            mostrarNunca={faltaEn === su.id && f.nuncaTuvo}
                            enDistribuidora={dist ? stockEn(i, dist.id) : 0}
                            distNombre={dist?.nombre}
                            prodTipo={i.tipo}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className={cx(c.num, c.mono, c.total, c.totalCol, total <= 0 && c.cero, orden.col === 'total' && c.colActiva)}>
                    {num(total)}{i.unidad === 'kg' ? ' kg' : ''}
                  </td>
                  {/* PRECIO FINAL, con el IVA adentro (19/8/2026, decisión del
                      dueño): acá se contesta "¿cuánto está?", y la respuesta
                      es lo que el cliente paga — el mismo número que la
                      etiqueta y el Formato de Venta. El neto es del motor. */}
                  <td className={cx(c.num, c.mono, c.precioBase, c.grupo)}>
                    {i.precioFinal > 0 ? money(i.precioFinal) : '—'}
                  </td>
                  <td>
                    {otras.length
                      ? otras.map((p) => (
                        <span key={p.listaId} className={c.chipLista}>
                          {listas.get(p.listaId) ?? `Lista ${p.listaId}`} <b>{money(p.precioFinal)}</b>
                        </span>
                      ))
                      : <span className={c.alta}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Paginador pag={pag} />
    </div>
  );
}
