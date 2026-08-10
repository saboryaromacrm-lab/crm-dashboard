/**
 * VENTAS — el listado de lo que pasó por el mostrador
 * ============================================================================
 * Es la pantalla que responde "¿qué se vendió?". Hasta que existió, la única
 * lista de ventas del sistema vivía dentro del detalle de un cliente: no había
 * forma de mirar el día, buscar un ticket viejo ni ver cuánto vendió cada
 * cajero.
 *
 * DOS REGLAS DE FONDO:
 *
 *  1. QUIÉN VE QUÉ. Administración (admin y superadmin) ve todo y filtra por lo
 *     que quiera. El resto ve SOLO la sucursal donde está operando y solo las
 *     ventas del mostrador: el selector de sucursal ni aparece, y el cajero no
 *     puede mirar la facturación de las otras bocas. No es un adorno de la
 *     vista — la consulta sale con la sucursal clavada.
 *  2. LA PLATA NO CUENTA LO ANULADO. Una venta anulada sigue en la lista (hay
 *     que poder auditarla) pero no suma en los totales. Los totales, además,
 *     son del FILTRO ENTERO y no de la página que se está viendo: "vendí $X
 *     hoy" tiene que sumar las 300 ventas del día, no las 20 visibles.
 *
 * El paginado lo corta el servidor (`usePaginadoServidor`): la tabla de ventas
 * crece para siempre y bajarla entera para paginar en memoria es tráfico tirado.
 */
import { useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { descargarCsv, csvNum } from '@shared/utils/csv.js';
import { useVentas } from '../context/VentasContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { ventasApi } from '../services/ventas.api.js';
import { MEDIOS_PAGO, ESTADOS_VENTA, TIPOS_VENTA, nroComprobante } from '../domain/constants.js';
import {
  Table, PanelHead, Stat, Btn, Pill, VentaEstadoPill, VentaTag,
  usePaginadoServidor, money, num, fmtFechaHora, isoDate, s,
} from '../components/ui.jsx';

/** `isoDate` es LOCAL (no UTC): a las 22 h de acá "hoy" sigue siendo hoy. */
const hoyIso = () => isoDate(new Date());
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};
const primeroDelMes = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Los atajos de fecha que se usan de verdad en el mostrador. */
const RANGOS = [
  { id: 'hoy', label: 'Hoy', calc: () => ({ desde: hoyIso(), hasta: hoyIso() }) },
  { id: 'ayer', label: 'Ayer', calc: () => ({ desde: diasAtras(1), hasta: diasAtras(1) }) },
  { id: 'semana', label: 'Últimos 7 días', calc: () => ({ desde: diasAtras(6), hasta: hoyIso() }) },
  { id: 'mes', label: 'Este mes', calc: () => ({ desde: primeroDelMes(), hasta: hoyIso() }) },
  { id: 'todo', label: 'Todo', calc: () => ({ desde: '', hasta: '' }) },
];

/** Los medios de pago de un ticket, cortitos: «Efectivo» o «Efectivo +1». */
function Medios({ medios }) {
  if (!medios?.length) return <span className={s.muted}>—</span>;
  const label = MEDIOS_PAGO[medios[0].medio] || medios[0].medio;
  if (medios.length === 1) return <span>{label}</span>;
  return (
    <span title={medios.map((m) => `${MEDIOS_PAGO[m.medio] || m.medio}: ${money(m.importe)}`).join(' · ')}>
      {label} <span className={s.muted}>+{medios.length - 1}</span>
    </span>
  );
}

export function ListadoVentasPanel() {
  const { sucursales, usuarios, clientes, ctx, openModal, esJefe } = useVentas();

  /* La sucursal del puesto manda para todos menos administración. */
  const sucursalFija = esJefe ? null : (ctx.sucursalId ?? null);

  const [rango, setRango] = useState('hoy');
  const [desde, setDesde] = useState(hoyIso);
  const [hasta, setHasta] = useState(hoyIso);
  const [sucursalId, setSucursalId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [cajaSesionId, setCajaSesionId] = useState('');
  const [estado, setEstado] = useState('');
  const [medioPago, setMedioPago] = useState('');
  const [origen, setOrigen] = useState('');
  const [conOferta, setConOferta] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const aplicarRango = (id) => {
    const r = RANGOS.find((x) => x.id === id);
    if (!r) return;
    const { desde: d, hasta: h } = r.calc();
    setRango(id); setDesde(d); setHasta(h);
  };

  /* La firma de los filtros: identifica el pedido y reinicia el paginado. */
  const firma = [
    desde, hasta, sucursalFija ?? sucursalId, usuarioId, clienteId, cajaSesionId,
    estado, medioPago, sucursalFija ? 'pos' : origen, conOferta ? '1' : '', buscaAplicada,
  ].join('|');

  // El total llega en la respuesta, así que el paginado arranca sin saberlo y
  // se acomoda con el primer resultado.
  const [total, setTotal] = useState(0);
  const pag = usePaginadoServidor(total, 'ventas-listado', firma);

  const filtros = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    sucursalId: sucursalFija ?? (sucursalId || undefined),
    usuarioId: usuarioId || undefined,
    clienteId: clienteId || undefined,
    cajaSesionId: cajaSesionId || undefined,
    estado: estado || undefined,
    medioPago: medioPago || undefined,
    /* Sin permiso de jefe, solo mostrador: el pedido mayorista y la orden web
     * los trabaja administración en sus propias pantallas. */
    origen: sucursalFija ? 'pos' : (origen || undefined),
    conOferta: conOferta ? 'true' : undefined,
    q: buscaAplicada || undefined,
  };

  const { data, loading, error, reload } = useResource(
    `ventas-listado:${firma}:${pag.offset}:${pag.limit}`,
    () => ventasApi.listadoVentas({ ...filtros, offset: pag.offset, limit: pag.limit })
      .then((r) => { setTotal(r.total); return r; }),
  );

  const filas = data?.filas ?? [];
  const t = data?.totales;

  const hayFiltro = !!(usuarioId || clienteId || cajaSesionId || estado || medioPago
    || origen || conOferta || buscaAplicada || (!sucursalFija && sucursalId) || rango !== 'hoy');

  const limpiar = () => {
    setUsuarioId(''); setClienteId(''); setCajaSesionId(''); setEstado('');
    setMedioPago(''); setOrigen(''); setConOferta(false);
    setBusca(''); setBuscaAplicada(''); setSucursalId('');
    aplicarRango('hoy');
  };

  /* Los turnos que aparecen en el resultado: alcanza para el corte "por turno"
   * sin pedir la lista entera de sesiones de caja. */
  const turnosVisibles = useMemo(() => {
    const vistos = new Map();
    for (const v of filas) if (v.cajaSesionId) vistos.set(v.cajaSesionId, v.sucursalNombre);
    return [...vistos.entries()].sort((a, b) => b[0] - a[0]);
  }, [filas]);

  const cajeros = useMemo(
    () => usuarios.filter((u) => u.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [usuarios],
  );

  /**
   * El CSV exporta lo que se está viendo (la página), y lo dice. Exportar el
   * filtro entero sería pedir todo de nuevo al servidor: si hace falta, se
   * sube el tamaño de página y se vuelve a exportar.
   */
  const exportar = () => descargarCsv(
    `ventas-${desde || 'todo'}.csv`,
    ['Comprobante', 'Tipo', 'Fecha', 'Sucursal', 'Cajero', 'Cliente', 'Turno', 'Renglones',
      'Unidades', 'Medios de pago', 'Descuento', 'De ofertas', 'Neto', 'IVA', 'Total', 'Estado', 'Origen'],
    filas.map((v) => [
      nroComprobante(v), TIPOS_VENTA[v.tipo]?.label ?? v.tipo, fmtFechaHora(v.fecha),
      v.sucursalNombre, v.cajeroNombre, v.clienteNombre, v.cajaSesionId ? `#${v.cajaSesionId}` : '',
      v.renglones, csvNum(v.unidades),
      (v.medios || []).map((m) => `${MEDIOS_PAGO[m.medio] || m.medio} ${csvNum(m.importe)}`).join(' + '),
      csvNum(v.descuentoTotal), csvNum(v.ofertaDescuento), csvNum(v.subtotalNeto), csvNum(v.ivaTotal),
      csvNum(v.total), ESTADOS_VENTA[v.estado]?.label ?? v.estado,
      v.origen === 'pos' ? 'Mostrador' : 'Pedido',
    ]),
  );

  const abrirDetalle = (v) => openModal('detalleVenta', { ventaId: v.id, onCambio: reload });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Ventas"
        desc={esJefe
          ? 'Todo lo que se vendió, con sus filtros. Clic en una fila para ver el ticket, reimprimirlo o anularlo. Los totales son del filtro completo y no cuentan las anuladas.'
          : 'Las ventas del mostrador de tu sucursal. Clic en una fila para ver el ticket y reimprimirlo.'}
        actions={<Btn small onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</Btn>}
      />

      <div className={s.stats}>
        <Stat label="Tickets" value={t ? num(t.tickets, 0) : '—'} />
        <Stat label="Vendido" value={t ? money(t.plata) : '—'} accent="accent-green" />
        <Stat label="Ticket promedio" value={t ? money(t.promedio) : '—'} />
        <Stat
          label="Descuentos"
          value={t ? money(t.descuentos) : '—'}
          accent={t && t.descuentos > 0 ? 'accent-amber' : undefined}
        />
      </div>

      {/* Lo que el mostrador pregunta después del total: con qué se pagó, cuánto
          costaron las promos y si hubo algo anulado. */}
      {t && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className={s.card} style={{ padding: '10px 14px', flex: '2 1 300px' }}>
            <span className={s['mini-label']}>CÓMO SE PAGÓ</span>
            {t.porMedio.length ? (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                {t.porMedio.map((m) => (
                  <span key={m.medio}>
                    {MEDIOS_PAGO[m.medio] || m.medio}: <strong>{money(m.importe)}</strong>
                  </span>
                ))}
              </div>
            ) : <div className={s.hint}>Sin cobros en el período.</div>}
          </div>
          <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 180px' }}>
            <span className={s['mini-label']}>LO QUE COSTARON LAS OFERTAS</span>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{money(t.ofertas.plata)}</div>
            <div className={s.hint}>
              en {t.ofertas.ventas} {t.ofertas.ventas === 1 ? 'ticket' : 'tickets'} · neto, ya incluido en descuentos
            </div>
          </div>
          {t.anuladas > 0 && (
            <div className={s.card} style={{ padding: '10px 14px', flex: '1 1 180px' }}>
              <span className={s['mini-label']}>ANULADAS</span>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--crm-color-danger)' }}>
                {t.anuladas}
              </div>
              <div className={s.hint}>{money(t.plataAnulada)} que no entraron</div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Filtros ---------------- */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RANGOS.map((r) => (
          <button
            key={r.id} type="button" className={s.badge}
            style={{
              cursor: 'pointer', padding: '5px 12px', fontSize: 12,
              borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--crm-color-border)',
              ...(rango === r.id
                ? { background: 'var(--crm-color-primary)', color: 'var(--crm-color-primary-contrast)', borderColor: 'var(--crm-color-primary)' }
                : {}),
            }}
            onClick={() => aplicarRango(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <input
          type="date" value={desde} title="Desde"
          onChange={(e) => { setDesde(e.target.value); setRango(''); }}
        />
        <input
          type="date" value={hasta} title="Hasta"
          onChange={(e) => { setHasta(e.target.value); setRango(''); }}
        />
        <input
          type="search" placeholder="Nº de ticket o cliente…" value={busca}
          style={{ flex: '1 1 180px', minWidth: 160 }}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setBuscaAplicada(busca.trim()); }}
          onBlur={() => setBuscaAplicada(busca.trim())}
        />
        {/* Sin permiso de jefe no hay selector: la sucursal es la del puesto. */}
        {esJefe ? (
          <select className={s['select-inline']} value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        ) : (
          <span className={s.badge} title="Tu puesto de trabajo">
            📍 {sucursales.find((x) => x.id === ctx.sucursalId)?.nombre ?? 'Sin sucursal'}
          </span>
        )}
        <select className={s['select-inline']} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Todos los cajeros</option>
          {cajeros.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
          <option value="">Cualquier medio de pago</option>
          {Object.entries(MEDIOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Confirmadas y anuladas</option>
          <option value="confirmada">Solo confirmadas</option>
          <option value="anulada">Solo anuladas</option>
        </select>
        <select className={s['select-inline']} value={cajaSesionId} onChange={(e) => setCajaSesionId(e.target.value)}>
          <option value="">Cualquier turno</option>
          {turnosVisibles.map(([id, suc]) => <option key={id} value={id}>Turno #{id} · {suc}</option>)}
        </select>
        {esJefe && (
          <>
            <select className={s['select-inline']} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Todos los clientes</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select className={s['select-inline']} value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="">Mostrador y pedidos</option>
              <option value="pos">Solo mostrador (POS)</option>
              <option value="presupuesto">Solo nacidas de un pedido</option>
            </select>
          </>
        )}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={conOferta} onChange={(e) => setConOferta(e.target.checked)} />
          Con oferta
        </label>
        <Btn small onClick={exportar} disabled={!filas.length}>Exportar CSV</Btn>
        {hayFiltro && <Btn small onClick={limpiar}>Limpiar</Btn>}
      </div>

      {error && <div className={cx(s.callout, s.warn)}>No se pudieron cargar las ventas: <strong>{error}</strong></div>}

      <Table
        cols={[
          { h: 'Comprobante' }, { h: 'Fecha' },
          ...(esJefe ? [{ h: 'Sucursal' }] : []),
          { h: 'Cajero' }, { h: 'Cliente' }, { h: 'Renglones', num: true },
          { h: 'Pago' }, { h: 'Descuento', num: true }, { h: 'Oferta' },
          { h: 'Total', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' },
        ]}
        empty={loading ? 'Cargando…' : 'No hay ventas con esos filtros.'}
        pag={pag}
      >
        {filas.map((v) => (
          <tr
            key={v.id}
            className={s.clickable}
            style={v.estado === 'anulada' ? { opacity: 0.6 } : undefined}
            onClick={() => abrirDetalle(v)}
          >
            <td>
              <VentaTag tipo={v.tipo} />{' '}
              <span className={s.mono}>{nroComprobante(v)}</span>
              {v.origen === 'presupuesto' && (
                <div className={s.hint}>de un pedido</div>
              )}
            </td>
            <td>
              {fmtFechaHora(v.fecha)}
              {v.cajaSesionId ? <div className={s.hint}>turno #{v.cajaSesionId}</div> : null}
            </td>
            {esJefe && <td>{v.sucursalNombre}</td>}
            <td>{v.cajeroNombre}</td>
            <td>
              {v.clienteNombre}
              {v.condicionPago === 'cuenta_corriente' && (
                <div className={s.hint}>cuenta corriente · saldo {money(v.saldo)}</div>
              )}
            </td>
            <td className={s.num}>{v.renglones}</td>
            <td><Medios medios={v.medios} /></td>
            <td className={s.num}>{v.descuentoTotal > 0 ? money(v.descuentoTotal) : <span className={s.muted}>—</span>}</td>
            <td>
              {v.ofertaDescuento > 0
                ? (
                  <span title={(v.ofertas || []).join(' · ')}>
                    <Pill pill="est-preparada" label={`🏷 ${money(v.ofertaDescuento)}`} />
                  </span>
                )
                : <span className={s.muted}>—</span>}
            </td>
            <td className={s.num}><strong>{money(v.total)}</strong></td>
            <td><VentaEstadoPill estado={v.estado} /></td>
            <td className={s['actions-col']}>
              <div className={s['row-actions']} onClick={(e) => e.stopPropagation()}>
                <Btn small onClick={() => abrirDetalle(v)}>Ver</Btn>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className={s.hint}>
        Los <strong>tickets abiertos</strong> (sin cobrar) no están acá: viven en el Punto de venta,
        que es donde se retoman.{' '}
        {esJefe
          ? 'Los totales suman el filtro completo y dejan afuera las anuladas; «Descuento» incluye lo que descontaron las ofertas.'
          : 'Ves las ventas de mostrador de tu sucursal.'}
      </div>
    </div>
  );
}
