/**
 * HISTORIAL DE FRACCIONAMIENTO Y OPERADORES (0102) — las dos pestañas nuevas.
 * ============================================================================
 * El historial NO sale del snapshot en memoria: crece para siempre, así que lo
 * pagina y lo suma el servidor. La pantalla pide una página (y sus totales) por
 * cada cambio de filtro, con el texto demorado para no disparar una consulta por
 * tecla, y descarta la respuesta vieja si llega después de la nueva.
 *
 * Lo que SÍ sale de la memoria son las opciones de los filtros (categorías y
 * gramajes de los granel del catálogo): ya están cargadas y no cuestan nada.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { num, fmtFechaHora, fmtTam } from '../domain/format.js';
import { Table, Stat, Btn, usePaginadoServidor, s } from '../components/ui.jsx';
import { refrescarOperadores } from '../components/OperadorFraccion.jsx';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rango(id) {
  const hoy = new Date();
  const d = (y, m, dia) => new Date(y, m, dia);
  switch (id) {
    case 'ayer': { const a = d(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1); return [iso(a), iso(a)]; }
    case '7d': return [iso(d(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6)), iso(hoy)];
    case 'mes': return [iso(d(hoy.getFullYear(), hoy.getMonth(), 1)), iso(hoy)];
    case 'mesAnt': return [iso(d(hoy.getFullYear(), hoy.getMonth() - 1, 1)), iso(d(hoy.getFullYear(), hoy.getMonth(), 0))];
    default: return [iso(hoy), iso(hoy)];
  }
}
const RANGOS = [
  { id: 'hoy', label: 'Hoy' }, { id: 'ayer', label: 'Ayer' }, { id: '7d', label: 'Últimos 7 días' },
  { id: 'mes', label: 'Este mes' }, { id: 'mesAnt', label: 'Mes pasado' },
];

const ORIGEN = {
  manual: { label: 'Fraccionado', pill: null },
  correccion: { label: 'Corrección', pill: 'est-pendiente' },
  pedido: { label: 'Pedido', pill: 'est-transito' },
};

const FILTROS_VACIOS = { sucursalId: '', operadorId: '', categoriaId: '', tamKg: '', origen: '', turno: '' };
const TURNOS = { manana: 'Mañana', tarde: 'Tarde' };
const soloDia = (v) => new Date(v).toLocaleDateString('es-AR');

/** "10×500 g · 4×250 g"; la corrección que baja paquetes va con signo. */
const detalle = (items) => items
  .map((i) => `${i.paquetes < 0 ? '−' : ''}${num(Math.abs(i.paquetes), 0)}×${fmtTam(i.tamKg)}`)
  .join(' · ');

const chip = (activo) => ({
  cursor: 'pointer', padding: '6px 12px', fontSize: 12.5, borderWidth: 1, borderStyle: 'solid',
  borderColor: activo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)',
  ...(activo ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)' } : {}),
});

/* ============================== HISTORIAL ============================== */
export function TabHistorial({ puede }) {
  const { store, isAdmin, toast, openModal } = useProductos();
  const [fechas, setFechas] = useState(() => { const [desde, hasta] = rango('hoy'); return { desde, hasta }; });
  const [f, setF] = useState(FILTROS_VACIOS);
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [operadores, setOperadores] = useState([]);
  /* Sube al registrar un fraccionado desde acá: vuelve a pedir la página. */
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 350);
    return () => clearTimeout(id);
  }, [texto]);

  // Todos, con los dados de baja: el historial los sigue nombrando.
  useEffect(() => {
    store.operadoresFraccion(true).then((r) => { if (r.ok) setOperadores(r.data); });
  }, [store]);

  /* Las opciones salen de los granel con paquetes del catálogo en memoria. */
  const { categorias, gramajes } = useMemo(() => {
    const nombreCat = new Map((store.state.catalogos?.categorias || []).map((c) => [c.id, c.nombre]));
    const cats = new Map();
    const tams = new Set();
    for (const p of store.state.productos) {
      if (p.tipo !== 'granel' || !(p.presentaciones || []).length) continue;
      if (p.categoriaId && nombreCat.has(p.categoriaId)) cats.set(p.categoriaId, nombreCat.get(p.categoriaId));
      for (const pr of p.presentaciones) if (pr.tamKg > 0) tams.add(Number(pr.tamKg));
    }
    return {
      categorias: [...cats].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      gramajes: [...tams].sort((a, b) => b - a),
    };
  }, [store.state.productos, store.state.catalogos]);

  const filtros = { ...fechas, ...f, q };
  const firma = JSON.stringify(filtros);
  const pag = usePaginadoServidor(data?.total ?? 0, 'historialFraccionamiento', firma);

  /*
   * UNA consulta por cambio. Al cambiar un filtro estando en la página 3, el
   * paginado vuelve a la 1 en el render siguiente: sin esto se pedirían las
   * dos (la 3 con el filtro nuevo, que se tira, y la 1). Con un filtro nuevo se
   * pide directo desde el principio, y lo ya pedido no se repite.
   */
  const ultimaFirma = useRef(null);
  const ultimoPedido = useRef(null);
  const turno = useRef(0);
  useEffect(() => {
    const offset = ultimaFirma.current !== firma ? 0 : pag.offset;
    ultimaFirma.current = firma;
    const clave = `${firma}|${offset}|${pag.limit}|${recarga}`;
    if (clave === ultimoPedido.current) return;
    ultimoPedido.current = clave;
    const mio = ++turno.current;
    setCargando(true);
    store.historialFraccionamientos({ ...JSON.parse(firma), offset, limit: pag.limit }).then((r) => {
      if (mio !== turno.current) return;
      setCargando(false);
      if (r.ok) { setData(r.data); setError(''); } else setError(r.error || 'No se pudo cargar el historial.');
    });
  }, [firma, pag.offset, pag.limit, store, recarga]);

  const setFiltro = (k, v) => setF((x) => ({ ...x, [k]: x[k] === v ? '' : v }));
  const hayFiltros = Object.values(f).some(Boolean) || !!texto;
  const rangoActivo = RANGOS.find((r) => { const [d, h] = rango(r.id); return d === fechas.desde && h === fechas.hasta; })?.id;

  const exportar = async () => {
    setExportando(true);
    const r = await store.exportarFraccionamientos(filtros);
    setExportando(false);
    if (!r.ok) { toast(r.error || 'No se pudo exportar.', 'err'); return; }
    if (!r.data.length) { toast('No hay nada para exportar con estos filtros.', 'err'); return; }
    descargarCsv(
      `fraccionamientos_${fechas.desde || 'inicio'}_${fechas.hasta || 'hoy'}.csv`,
      ['Fecha', 'Turno', 'Operador', 'Cargado por', 'Cargado el', 'Sucursal', 'Código interno', 'Producto', 'Marca', 'Categoría',
        'Tipo', 'Pedido', 'Gramaje', 'Paquetes', 'Kg', 'Motivo'],
      r.data.map((x) => [
        x.diferido ? soloDia(x.fecha) : fmtFechaHora(x.fecha), TURNOS[x.turno] || '', x.operadorNombre || '',
        x.usuarioNombre || '', fmtFechaHora(x.registradoEn), x.sucursalNombre || '',
        x.codigoPropio || '', x.productoNombre || '(producto borrado)', x.marcaNombre || '', x.categoriaNombre || '',
        ORIGEN[x.origen]?.label || x.origen, x.transferenciaCodigo || '', fmtTam(x.tamKg),
        String(x.paquetes), csvNum(x.kg, 3), x.motivo || '',
      ]),
    );
    toast(`${num(r.data.length, 0)} renglón(es) exportado(s).`, 'ok');
  };

  const t = data?.totales;
  const nombreOperador = (id) => operadores.find((o) => String(o.id) === String(id))?.nombre;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      {puede && (
        <div>
          <Btn variant="btn-primary" onClick={() => openModal('registrarFraccionado', { onRegistrado: () => setRecarga((n) => n + 1) })}>
            Registrar fraccionado
          </Btn>
        </div>
      )}

      <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 8 }}>
        {RANGOS.map((r) => (
          <button
            key={r.id} type="button" className={cx(s.badge)} style={chip(rangoActivo === r.id)}
            onClick={() => { const [desde, hasta] = rango(r.id); setFechas({ desde, hasta }); }}
          >
            {r.label}
          </button>
        ))}
        <input type="date" value={fechas.desde} max={fechas.hasta || undefined} aria-label="Desde"
          onChange={(e) => setFechas((x) => ({ ...x, desde: e.target.value }))} style={{ width: 'auto' }} />
        <input type="date" value={fechas.hasta} min={fechas.desde || undefined} aria-label="Hasta"
          onChange={(e) => setFechas((x) => ({ ...x, hasta: e.target.value }))} style={{ width: 'auto' }} />
        <span style={{ flex: 1 }} />
        <Btn onClick={exportar} disabled={exportando || !data?.total}>
          {exportando ? 'Exportando…' : 'Exportar CSV'}
        </Btn>
      </div>

      <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          type="search" value={texto} placeholder="Buscar producto o marca…"
          onChange={(e) => setTexto(e.target.value)} style={{ minWidth: 200, flex: 1 }}
        />
        {isAdmin && store.state.sucursales.length > 1 && (
          <select value={f.sucursalId} onChange={(e) => setF((x) => ({ ...x, sucursalId: e.target.value }))} style={{ width: 'auto' }} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {store.state.sucursales.map((su) => <option key={su.id} value={su.id}>{su.nombre}</option>)}
          </select>
        )}
        <select value={f.operadorId} onChange={(e) => setF((x) => ({ ...x, operadorId: e.target.value }))} style={{ width: 'auto' }} aria-label="Operador">
          <option value="">Todos los operadores</option>
          {operadores.map((o) => <option key={o.id} value={o.id}>{o.nombre}{o.activo ? '' : ' (de baja)'}</option>)}
          <option value="sin">Sin operador</option>
        </select>
        <select value={f.categoriaId} onChange={(e) => setF((x) => ({ ...x, categoriaId: e.target.value }))} style={{ width: 'auto' }} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={f.tamKg} onChange={(e) => setF((x) => ({ ...x, tamKg: e.target.value }))} style={{ width: 'auto' }} aria-label="Gramaje">
          <option value="">Todos los gramajes</option>
          {gramajes.map((g) => <option key={g} value={g}>{fmtTam(g)}</option>)}
        </select>
        <select value={f.origen} onChange={(e) => setF((x) => ({ ...x, origen: e.target.value }))} style={{ width: 'auto' }} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={f.turno} onChange={(e) => setF((x) => ({ ...x, turno: e.target.value }))} style={{ width: 'auto' }} aria-label="Turno">
          <option value="">Todos los turnos</option>
          {Object.entries(TURNOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {hayFiltros && <Btn small onClick={() => { setF(FILTROS_VACIOS); setTexto(''); }}>Limpiar filtros</Btn>}
      </div>

      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}

      <div className={s.stats}>
        <Stat label="Registros" value={t ? num(t.registros, 0) : '—'} />
        <Stat label={f.tamKg ? `Paquetes de ${fmtTam(Number(f.tamKg))}` : 'Paquetes armados'} value={t ? num(t.paquetes, 0) : '—'} />
        <Stat label="Kg fraccionados" value={t ? num(t.kg, 3) : '—'} />
        {t?.correcciones > 0 && <Stat label="Correcciones" value={num(t.correcciones, 0)} accent="accent-amber" />}
        {t?.sinOperador > 0 && <Stat label="Sin operador" value={num(t.sinOperador, 0)} />}
      </div>

      {data && (data.porOperador.length > 1 || data.porGramaje.length > 1) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--crm-space-4)' }}>
          {data.porOperador.length > 0 && (
            <div>
              <h3 className={s['card-title']} style={{ marginTop: 0 }}>Por operador</h3>
              <Table cols={[{ h: 'Operador' }, { h: 'Registros', num: true }, { h: 'Paquetes', num: true }, { h: 'Kg', num: true }]}>
                {data.porOperador.map((o) => {
                  const id = o.operadorId == null ? 'sin' : String(o.operadorId);
                  return (
                    <tr key={id} className={s.clickable} title="Filtrar por este operador"
                      onClick={() => setFiltro('operadorId', id)}
                      style={f.operadorId === id ? { background: 'var(--crm-color-primary-soft, rgba(22,101,52,.08))' } : undefined}>
                      <td>{o.operadorId == null ? <span className={s.muted}>Sin operador</span> : o.nombre}</td>
                      <td className={cx(s.num, s.mono)}>{num(o.registros, 0)}</td>
                      <td className={cx(s.num, s.mono)}>{num(o.paquetes, 0)}</td>
                      <td className={cx(s.num, s.mono)}>{num(o.kg, 3)}</td>
                    </tr>
                  );
                })}
              </Table>
            </div>
          )}
          {data.porGramaje.length > 0 && (
            <div>
              <h3 className={s['card-title']} style={{ marginTop: 0 }}>Por gramaje</h3>
              <Table cols={[{ h: 'Gramaje' }, { h: 'Registros', num: true }, { h: 'Paquetes', num: true }]}>
                {data.porGramaje.map((g) => (
                  <tr key={g.tamKg} className={s.clickable} title="Filtrar por este gramaje"
                    onClick={() => setFiltro('tamKg', String(g.tamKg))}
                    style={f.tamKg === String(g.tamKg) ? { background: 'var(--crm-color-primary-soft, rgba(22,101,52,.08))' } : undefined}>
                    <td>{fmtTam(g.tamKg)}</td>
                    <td className={cx(s.num, s.mono)}>{num(g.registros, 0)}</td>
                    <td className={cx(s.num, s.mono)}>{num(g.paquetes, 0)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </div>
      )}

      <div style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
        <Table
          cols={[
            { h: 'Fecha' }, { h: 'Operador' }, { h: 'Productos y paquetes' }, { h: 'Kg', num: true },
            { h: 'Sucursal' }, { h: 'Tipo' }, { h: 'Cargado por' },
          ]}
          empty={data ? 'No hay fraccionamientos con estos filtros.' : 'Cargando…'}
          pag={pag}
        >
          {(data?.filas || []).map((x) => {
            const o = ORIGEN[x.origen] || { label: x.origen };
            return (
              <tr key={x.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {/* Asentado después no hay hora real: se muestra el día y el turno. */}
                  <div>{x.diferido ? soloDia(x.fecha) : fmtFechaHora(x.fecha)}</div>
                  <div className={s.muted} style={{ fontSize: 12 }}>Turno {(TURNOS[x.turno] || '').toLowerCase()}</div>
                  {x.diferido && (
                    <div style={{ fontSize: 12, color: 'var(--crm-color-warning)' }} title="Se asentó después de hecho">
                      cargado {fmtFechaHora(x.registradoEn)}
                    </div>
                  )}
                </td>
                <td>{x.operadorNombre || <span className={s.muted}>—</span>}</td>
                <td>
                  {x.productos.map((p) => (
                    <div key={p.productoId ?? 'borrado'} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <span>
                        {p.nombre || <span className={s.muted}>(producto borrado)</span>}
                        {p.marca && <span className={s.muted} style={{ fontSize: 12 }}> · {p.marca}</span>}
                      </span>
                      <span className={s.mono} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{detalle(p.items)}</span>
                    </div>
                  ))}
                </td>
                <td className={cx(s.num, s.mono)}>{num(x.kg, 3)}</td>
                <td>{x.sucursalNombre || '—'}</td>
                <td>
                  {o.pill ? <span className={cx(s.pill, s[o.pill])}>{o.label}</span> : o.label}
                  {x.transferenciaCodigo && <div className={s.muted} style={{ fontSize: 12 }}>{x.transferenciaCodigo}</div>}
                  {x.motivo && <div className={s.muted} style={{ fontSize: 12 }} title={x.motivo}>{x.motivo}</div>}
                </td>
                <td className={s.muted}>{x.usuarioNombre || '—'}</td>
              </tr>
            );
          })}
        </Table>
      </div>

      <div className={s.hint}>
        Los totales son del <strong>filtro entero</strong>, no de la página. Cada fila es un registro
        completo (con todos sus productos); con un producto, categoría o gramaje elegido, las tarjetas y
        los cuadros cuentan <strong>solo lo que coincide</strong>. Las correcciones restan: si una tanda
        se cargó con 20 y eran 19, el total ya dice 19. Clic en un operador o un gramaje de los cuadros
        para filtrar por él{f.operadorId && nombreOperador(f.operadorId) ? ` (hoy: ${nombreOperador(f.operadorId)})` : ''}.
      </div>
    </div>
  );
}

/* ============================== OPERADORES ============================== */
export function TabOperadores() {
  const { store, can, toast } = useProductos();
  const puede = can('fraccion_operadores');
  const sucursales = store.state.sucursales;
  const [lista, setLista] = useState(null);
  const [alta, setAlta] = useState({ nombre: '', sucursalId: '' });
  const [edit, setEdit] = useState(null); // { id, nombre, sucursalId }
  const [ocupado, setOcupado] = useState(false);

  const cargar = () => store.operadoresFraccion(true).then((r) => {
    if (r.ok) setLista(r.data); else toast(r.error || 'No se pudo cargar la lista.', 'err');
  });
  useEffect(() => { cargar(); }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const nombreSuc = (id) => (id == null ? 'Todas' : sucursales.find((x) => x.id === id)?.nombre ?? '—');

  const guardar = async (fn, okMsg) => {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) { toast(r.error || 'No se pudo guardar.', 'err'); return false; }
    toast(okMsg, 'ok');
    await Promise.all([cargar(), refrescarOperadores(store)]);
    return true;
  };

  const crear = async () => {
    const nombre = alta.nombre.trim();
    if (!nombre) { toast('Escribí el nombre del operador.', 'err'); return; }
    const ok = await guardar(
      () => store.crearOperadorFraccion({ nombre, sucursalId: alta.sucursalId ? Number(alta.sucursalId) : null }),
      `${nombre} agregado.`,
    );
    if (ok) setAlta({ nombre: '', sucursalId: '' });
  };

  const guardarEdit = async () => {
    const nombre = edit.nombre.trim();
    if (!nombre) { toast('El nombre no puede quedar vacío.', 'err'); return; }
    const ok = await guardar(
      () => store.editarOperadorFraccion(edit.id, { nombre, sucursalId: edit.sucursalId ? Number(edit.sucursalId) : null }),
      'Operador guardado.',
    );
    if (ok) setEdit(null);
  };

  const cambiarActivo = (o) => guardar(
    () => store.editarOperadorFraccion(o.id, { activo: !o.activo }),
    o.activo ? `${o.nombre} dado de baja.` : `${o.nombre} reactivado.`,
  );

  const activos = (lista || []).filter((o) => o.activo).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div className={cx(s.callout, s.info)} style={{ margin: 0 }}>
        Las personas que fraccionan, <strong>sin usuario ni contraseña</strong>. Al fraccionar se elige
        quién lo hizo, y cada PC recuerda al último. Con al menos un operador activo, elegirlo es{' '}
        <strong>obligatorio</strong>. Un operador no se borra: se <strong>da de baja</strong>, y el
        historial lo sigue nombrando.
      </div>

      {puede && (
        <div className={cx(s.card, s.cardPad)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div className={s.field} style={{ marginBottom: 0 }}>
              <label htmlFor="op-alta-nombre">Nombre <span className={s.req}>*</span></label>
              <input id="op-alta-nombre" value={alta.nombre} maxLength={60} placeholder="Ej.: Juan Pérez"
                onChange={(e) => setAlta((x) => ({ ...x, nombre: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} />
            </div>
            <div className={s.field} style={{ marginBottom: 0 }}>
              <label htmlFor="op-alta-suc">Trabaja en</label>
              <select id="op-alta-suc" value={alta.sucursalId} onChange={(e) => setAlta((x) => ({ ...x, sucursalId: e.target.value }))}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((su) => <option key={su.id} value={su.id}>{su.nombre}</option>)}
              </select>
            </div>
            <div>
              <Btn variant="btn-primary" onClick={crear} disabled={ocupado}>Agregar operador</Btn>
            </div>
          </div>
        </div>
      )}

      <Table
        cols={[{ h: 'Nombre' }, { h: 'Trabaja en' }, { h: 'Estado' }, ...(puede ? [{ h: '', cls: 'actions-col' }] : [])]}
        empty={lista ? 'Todavía no hay operadores: mientras no haya ninguno, fraccionar no pide quién lo hizo.' : 'Cargando…'}
      >
        {(lista || []).map((o) => (edit?.id === o.id ? (
          <tr key={o.id}>
            <td><input value={edit.nombre} maxLength={60} aria-label="Nombre" onChange={(e) => setEdit((x) => ({ ...x, nombre: e.target.value }))} /></td>
            <td>
              <select value={edit.sucursalId} aria-label="Trabaja en" onChange={(e) => setEdit((x) => ({ ...x, sucursalId: e.target.value }))}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((su) => <option key={su.id} value={su.id}>{su.nombre}</option>)}
              </select>
            </td>
            <td />
            <td className={s['actions-col']} style={{ whiteSpace: 'nowrap' }}>
              <Btn small variant="btn-primary" onClick={guardarEdit} disabled={ocupado}>Guardar</Btn>{' '}
              <Btn small onClick={() => setEdit(null)}>Cancelar</Btn>
            </td>
          </tr>
        ) : (
          <tr key={o.id} style={o.activo ? undefined : { opacity: 0.55 }}>
            <td><strong>{o.nombre}</strong></td>
            <td>{nombreSuc(o.sucursalId)}</td>
            <td>
              <span className={cx(s.pill, o.activo ? s['st-disponible'] : s['est-pendiente'])}>
                {o.activo ? 'Activo' : 'De baja'}
              </span>
            </td>
            {puede && (
              <td className={s['actions-col']} style={{ whiteSpace: 'nowrap' }}>
                {o.activo && (
                  <Btn small onClick={() => setEdit({ id: o.id, nombre: o.nombre, sucursalId: o.sucursalId ?? '' })} disabled={ocupado}>
                    Editar
                  </Btn>
                )}{' '}
                <Btn small onClick={() => cambiarActivo(o)} disabled={ocupado}>
                  {o.activo ? 'Dar de baja' : 'Reactivar'}
                </Btn>
              </td>
            )}
          </tr>
        )))}
      </Table>

      {lista && (
        <div className={s.hint}>
          {num(activos, 0)} activo(s){lista.length > activos ? ` · ${num(lista.length - activos, 0)} de baja` : ''}.
          {!puede && ' Para dar de alta o de baja operadores hace falta el permiso «Fraccionamiento: alta y baja de operadores».'}
        </div>
      )}
    </div>
  );
}
