import { useCallback, useMemo, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ModalDesdeAfuera } from '@modules/productos/components/ModalDesdeAfuera.jsx';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { provApi, CONDICIONES_COMPRA, MEDIOS_HABITUALES, MEDIOS_PAGO_REAL } from '../services/proveedores.api.js';
import {
  Btn, Di, EcheqCubre, EstadoEcheqPill, ImporteCompromiso, PanelHead, Pill, Saldo, Stat, Table, VencePill,
  fmtFecha, money, s, usePaginado,
} from '../components/ui.jsx';

/**
 * La fecha de asiento (5/11/2026): solo el día. La «fecha de carga» de las
 * compras es un día (se guarda a mediodía), así que una hora ahí mentiría.
 */
const fechaAsentado = (v) => (v ? fmtFecha(v) : '—');

const EPS = 0.009;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * LA FACTURA YA TIENE SU ECHEQ (4/11/2026, pedido del dueño): «entro a su
 * cuenta y veo que no se pagó nada, pero sí se pagó y se generó un echeq».
 * El saldo sigue igual hasta que el banco debita (al marcarlo cobrado), pero
 * cada factura dice con qué echeq se paga y cuándo sale. `cubren`: los echeqs
 * que la cubren, con lo que cubre cada uno.
 */
function ConEcheq({ cubren }) {
  if (!cubren?.length) return null;
  return cubren.map(({ e, monto }) => {
    const hecho = e.estado === 'emitido' || e.estado === 'entregado';
    const cuando = hecho && e.diasRest < 0
      ? `debitaba el ${fmtFecha(e.fechaVenc)}: si ya salió, marcalo cobrado en Echeqs`
      : `se debita el ${fmtFecha(e.fechaVenc)}`;
    return (
      <div key={e.id} className={s.hint} style={{ margin: '2px 0 0' }}>
        <Pill pill={hecho ? 'est-transito' : 'est-pendiente'} label={hecho ? `Echeq${e.numero ? ` N° ${e.numero}` : ''}` : 'Echeq pendiente de confirmar'} />
        {' '}{money(monto)} · {cuando}
      </div>
    );
  });
}

/** El día CALENDARIO de un movimiento, en hora local. Cortar el ISO
 *  (`slice(0, 10)`) daría el día en UTC: un pago hecho a las 22 h figuraría
 *  mañana y se escaparía del filtro "hasta hoy". */
const diaLocal = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Cuánto pasó desde un día, en días calendario locales: "hoy", "ayer",
 *  "hace 5 días", "hace 2 meses". Para la tarjeta de conciliado (30/10/2026). */
const haceCuanto = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const dias = Math.round(
    (new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000,
  );
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 60) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return anios === 1 ? 'hace más de un año' : `hace más de ${anios} años`;
};

const KIND = {
  comprobante: { label: 'Factura', pill: 'est-pendiente' },
  nc: { label: 'NC', pill: 'est-recibida' },
  gasto: { label: 'Gasto', pill: 'est-pendiente' },
  pago: { label: 'Pago', pill: 'est-recibida' },
  ajuste_debe: { label: 'Ajuste DEBE', pill: 'est-pendiente' },
  ajuste_haber: { label: 'Ajuste HABER', pill: 'est-recibida' },
  // La factura del mes (0158): el papel fiscal de las entregas, en cero.
  factura_mes: { label: 'Factura del mes', pill: null },
};

/**
 * La etiqueta que manda la API ya empieza con el tipo del documento ("Factura A
 * 9999-00099001", "Gasto #1 · …", "Pago (efectivo)"). Se la parte en dos: la
 * primera palabra va al pill y el resto al texto, así la fila no dice "Factura
 * Factura A …". Sale del DATO y no de una tabla nuestra, así que una
 * liquidación dice "Liquidación" y no "Factura".
 */
const partirEtiqueta = (etiqueta) => {
  const e = String(etiqueta ?? '').trim();
  const i = e.indexOf(' ');
  return i < 0 ? [e, ''] : [e.slice(0, i), e.slice(i + 1)];
};

/** Los grupos del filtro, en palabras del negocio y no del esquema. */
const FILTROS = [
  ['', 'Todos los movimientos'],
  ['deuda', 'Lo que SUMA deuda'],
  ['haber', 'Lo que la RESTA (pagos, NC, ajustes)'],
  ['comprobante', 'Facturas y liquidaciones'],
  ['nc', 'Notas de crédito'],
  ['gasto', 'Gastos'],
  ['pago', 'Pagos'],
  ['flete', 'Solo fletes adelantados'],
  ['ajuste', 'Ajustes manuales'],
];

/*
 * EL ORDEN DEL MAYOR, definido acá y usado para las dos cosas: calcular el
 * saldo acumulado y mostrar las filas (al revés). Tienen que ser EL MISMO
 * orden: si el acumulado se calcula con un criterio y la tabla se dibuja con
 * otro, la columna Saldo deja de cerrar leída de abajo hacia arriba. Pasaba de
 * verdad — una factura y un pago del mismo día con el mismo id (son tablas
 * distintas, los id se repiten) se desempataban al revés en cada lado.
 *
 * Dentro del mismo día primero lo que genera la deuda y después lo que la
 * cancela, que es como sucede: se factura y luego se paga.
 */
const ORDEN_KIND = {
  comprobante: 0, gasto: 1, ajuste_debe: 2, nc: 3, ajuste_haber: 4, pago: 5, factura_mes: 6,
};
/*
 * Se compara por DÍA y no por la hora del timestamp, a propósito: la hora que
 * queda grabada es incidental —el pago se guarda a medianoche del día elegido y
 * la factura con la hora en que se cargó—, así que ordenar por timestamp ponía
 * el pago ANTES de la factura que estaba pagando y el mayor arrancaba con el
 * saldo en negativo. En este sistema la fecha de un comprobante y de un pago es
 * un día de calendario; el orden dentro del día lo pone ORDEN_KIND.
 */
const cmpCronologico = (a, b) => (
  diaLocal(a.fecha).localeCompare(diaLocal(b.fecha))
  || (ORDEN_KIND[a.kind] ?? 9) - (ORDEN_KIND[b.kind] ?? 9)
  || a.id - b.id
);

const pasaFiltroTipo = (m, f) => {
  if (!f) return true;
  if (f === 'deuda') return m.debe > EPS;
  if (f === 'haber') return m.haber > EPS;
  if (f === 'ajuste') return m.kind === 'ajuste_debe' || m.kind === 'ajuste_haber';
  // El flete es un pago con una naturaleza propia, no un tipo de movimiento
  // aparte: filtrarlo responde "¿cuánto le adelanté de fletes a este proveedor?".
  if (f === 'flete') return m.kind === 'pago' && !!m.esFlete;
  // La NC de un gasto (27/9/2026) sale con las NC y también con los gastos.
  if (f === 'nc' && m.kind === 'nc_gasto') return true;
  if (f === 'gasto' && m.kind === 'nc_gasto') return true;
  // La factura del mes (0158) es un papel más del proveedor, aunque vaya en cero.
  if (f === 'comprobante' && m.kind === 'factura_mes') return true;
  return m.kind === f;
};

/**
 * EL ESTADO DE CUENTA DEL PROVEEDOR — pantalla completa, no modal.
 * ============================================================================
 * Es la hoja que se mira cuando el proveedor llama a reclamar: de qué está
 * hecho el saldo, qué le queda impago documento por documento, qué se le
 * prometió, y el mayor entero con su saldo acumulado renglón por renglón.
 *
 * Y es desde acá que se le PAGA: el botón registra el pago de siempre del
 * sistema (con su egreso de caja y el puente que cierra compromisos) y, si se
 * tildan documentos, lo aplica en el mismo acto.
 *
 * El saldo acumulado se calcula sobre TODOS los movimientos en orden
 * cronológico y después se filtra para mostrar: calcularlo sobre lo filtrado
 * daría una columna que miente en cuanto alguien elige un rango de fechas.
 */
export function EdocProveedorPage({ proveedorId, onVolver, onCambio }) {
  const { act, openModal, esJefe } = useProveedores();
  const { can } = usePermissions();
  /* VER LA FACTURA ENTERA (11/11/2026, pedido del dueño): clic en una factura,
   * liquidación, ND o NC abre su detalle de Compras, solo para mirar. Con la
   * misma llave que lo deja ver allá; la liquidación pide además la suya. */
  const [verComp, setVerComp] = useState(null);
  const cerrarComp = useCallback(() => setVerComp(null), []);
  const traerComp = useCallback((store) => store.asegurarComprobante(verComp), [verComp]);
  const seAbre = (m) => (m.kind === 'comprobante' || m.kind === 'nc') && can('compras.facturacion')
    && (m.tipoDoc !== 'liquidacion' || can('liquidaciones'));
  const { data: d, loading, error, reload } = useResource(
    `edoc:${proveedorId}`,
    () => provApi.edocProveedor(proveedorId),
  );

  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');

  /** Recargar la página Y el listado de atrás: los dos leen el mismo saldo. */
  const refrescar = () => { reload(); onCambio?.(); };

  const conAcumulado = useMemo(() => {
    const cron = [...(d?.movs ?? [])].sort(cmpCronologico);
    let acc = 0;
    const conSaldo = cron.map((m) => {
      acc = r2(acc + m.debe - m.haber);
      return { ...m, acumulado: acc };
    });
    // Del más nuevo al más viejo: el inverso EXACTO del orden con el que se
    // acumuló, así la columna Saldo cierra renglón a renglón.
    return conSaldo.reverse();
  }, [d]);

  const filtrados = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return conAcumulado.filter((m) => {
      if (!pasaFiltroTipo(m, tipo)) return false;
      const dia = diaLocal(m.fecha);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (t) {
        const texto = `${KIND[m.kind]?.label ?? m.kind} ${m.etiqueta} ${m.detalle ?? ''} `
          + `${m.usuarioNombre ?? ''} ${m.referencia ?? ''}`;
        if (!texto.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [conAcumulado, tipo, desde, hasta, buscar]);

  const totFiltro = useMemo(() => ({
    debe: r2(filtrados.reduce((a, m) => a + m.debe, 0)),
    haber: r2(filtrados.reduce((a, m) => a + m.haber, 0)),
  }), [filtrados]);

  const pag = usePaginado(filtrados, 'edoc-movs', `${tipo}|${desde}|${hasta}|${buscar}`);
  const hayFiltro = !!(tipo || desde || hasta || buscar.trim());
  const limpiar = () => { setTipo(''); setDesde(''); setHasta(''); setBuscar(''); };

  const conciliar = () => act(provApi.conciliar(proveedorId), 'Conciliado hasta hoy.').then(refrescar);
  const desconciliar = () => act(provApi.desconciliar(proveedorId), 'Marca de conciliación quitada.').then(refrescar);
  const borrarAjuste = (m) => openModal('borrarAjuste', { ajuste: m, onDone: refrescar });

  const volver = <Btn small onClick={onVolver}>← Estados de cuenta</Btn>;

  if (loading || error || !d) {
    return (
      <div>
        <div style={{ marginBottom: 10 }}>{volver}</div>
        {loading
          ? <div className={s['empty-state']}>Cargando el estado de cuenta…</div>
          : <div className={cx(s.callout, s.warn)}>{error || 'No se encontró el proveedor.'}</div>}
      </div>
    );
  }

  const p = d.proveedor;
  const echeqs = d.echeqs ?? [];
  const enCartera = (e) => e.estado === 'emitido' || e.estado === 'entregado';
  /* Lo comprometido es lo que falta de cada compromiso más lo que los echeqs hechos no cubren
   * de ninguna factura (0205): eso también se va a debitar. */
  const comprometido = r2((d.compromisos ?? []).reduce((a, k) => a + k.falta, 0)
    + echeqs.filter(enCartera).reduce((a, e) => a + e.sinFactura, 0));
  const docs = d.docsPendientes ?? [];
  /* LO VENCIDO (31/10/2026, pedido del dueño): de lo impago, lo que ya pasó
   * su vencimiento. Vence el día que dice la factura y, si no dice, la fecha
   * más los días de pago del proveedor — la misma regla que el estado
   * «vencido» de Estados de cuenta. Sin vencimiento ni días de pago, no vence. */
  const venceDoc = (doc) => {
    if (doc.vencimiento) return diaLocal(doc.vencimiento);
    if (!(p.diasPago > 0) || !doc.fecha) return '';
    const f = new Date(`${diaLocal(doc.fecha)}T00:00:00`);
    f.setDate(f.getDate() + p.diasPago);
    return diaLocal(f);
  };
  const hoyDia = diaLocal(new Date());
  const vencidos = docs.filter((doc) => { const v = venceDoc(doc); return v && v < hoyDia && doc.saldo > EPS; });
  const montoVencido = r2(vencidos.reduce((a, doc) => a + doc.saldo, 0));
  /* Qué echeqs cubren cada factura, y lo que suman: el saldo baja recién cuando se debitan. */
  const cubrenDe = new Map();
  for (const e of echeqs) {
    for (const f of e.facturas) cubrenDe.set(f.comprobanteId, [...(cubrenDe.get(f.comprobanteId) ?? []), { e, monto: f.falta }]);
  }
  const conEcheq = (comprobanteId) => r2((cubrenDe.get(comprobanteId) ?? []).reduce((a, x) => a + x.monto, 0));
  const totalEcheqs = r2(echeqs.reduce((a, e) => a + e.importe, 0));
  const sinCubrir = r2(Math.max(0, d.saldo - totalEcheqs));
  const vencidoConEcheq = r2(vencidos.filter((doc) => doc.tipo === 'comprobante')
    .reduce((a, doc) => a + Math.min(doc.saldo, conEcheq(doc.docId)), 0));
  const abrirPago = (preseleccion = []) => openModal('pagoProveedor', {
    proveedor: p, docs, preseleccion, saldo: d.saldo, onChange: refrescar,
  });

  return (
    <div>
      <div style={{ marginBottom: 10 }}>{volver}</div>

      <PanelHead
        title={p.nombre}
        desc={[
          p.modoCuenta === 'libre' ? 'Cuenta libre (pagos a cuenta)' : 'Cuenta por facturas',
          CONDICIONES_COMPRA[p.condicionCompra] ? `emite ${CONDICIONES_COMPRA[p.condicionCompra]}` : null,
          p.medioHabitual ? `cobra por ${MEDIOS_HABITUALES[p.medioHabitual] ?? p.medioHabitual}` : null,
          p.diasPago ? `a ${p.diasPago} días` : null,
          p.cuit ? `CUIT ${p.cuit}` : 'sin CUIT cargado',
        ].filter(Boolean).join(' · ')}
        actions={(
          <>
            <Btn variant="btn-primary" onClick={() => abrirPago()}>Registrar un pago</Btn>
            {p.facturaMensual && <Btn onClick={() => openModal('facturasMes', { proveedorId, onDone: refrescar })}>Facturas del mes</Btn>}
            <Btn onClick={() => openModal('ajuste', { proveedorId, saldo: d.saldo, comprometido, onDone: refrescar })}>+ Ajuste</Btn>
            <Btn onClick={() => openModal('ficha', { proveedorId })}>Ver ficha</Btn>
            {p.conciliadoHasta
              ? <Btn onClick={desconciliar}>Quitar conciliación</Btn>
              : <Btn onClick={conciliar}>Concilié con su resumen</Btn>}
          </>
        )}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Saldo" value={money(d.saldo)} accent={d.saldo > EPS ? 'accent-red' : undefined} />
        {echeqs.length > 0 && (
          <Stat
            label="Con echeqs (sin debitar)"
            value={money(totalEcheqs)}
            nota={`${echeqs.length} ${echeqs.length === 1 ? 'echeq' : 'echeqs'} · el primero debita el ${fmtFecha(echeqs.map((e) => e.fechaVenc).sort()[0])} · ${
              sinCubrir > EPS ? `sin cubrir ${money(sinCubrir)}` : 'cubren todo el saldo'}`}
          />
        )}
        <Stat label="Comprometido" value={comprometido > 0 ? money(comprometido) : '—'} />
        {/* «Pagos sin aplicar» (2/11/2026) y «Proyectado» (3/11/2026) se sacaron a pedido del dueño: no los usa.
            El proyectado sigue en la lista de Estados de cuenta. */}
        <Stat
          label={p.diasPago > 0 ? `Vencido (más de ${p.diasPago} días)` : 'Vencido'}
          value={montoVencido > EPS ? money(montoVencido) : '—'}
          accent={montoVencido > EPS ? 'accent-red' : undefined}
          nota={vencidos.length
            ? `${vencidos.length} ${vencidos.length === 1 ? 'documento' : 'documentos'} · desde el ${fmtFecha(`${vencidos.map(venceDoc).sort()[0]}T00:00:00`)}${
              vencidoConEcheq > EPS ? ` · de eso, ${money(vencidoConEcheq)} ya tiene echeq` : ''}`
            : (p.diasPago > 0 || docs.some((doc) => doc.vencimiento) ? 'nada vencido' : 'sin días de pago en la ficha')}
        />
        <Stat label="Arrastra deuda desde" value={d.deudaDesde ? fmtFecha(d.deudaDesde) : '—'} />
        <Stat
          label="Conciliado hasta"
          value={p.conciliadoHasta
            ? <>{fmtFecha(p.conciliadoHasta)} <span style={{ fontSize: 14, fontWeight: 500 }}>· {haceCuanto(p.conciliadoHasta)}</span></>
            : 'Sin conciliar'}
          accent={p.conciliadoHasta ? 'accent-green' : undefined}
        />
      </div>

      <div className={s['section-title']}>De qué está hecho el saldo</div>
      <div className={s['detalle-grid']}>
        <Di label="Mercadería (facturas y ND)">{money(d.totales.mercaderia)}</Di>
        <Di label="Notas de crédito">{d.totales.notasCredito > 0 ? `− ${money(d.totales.notasCredito)}` : '—'}</Di>
        <Di label="Gastos">{d.totales.gastos > 0 ? money(d.totales.gastos) : '—'}</Di>
        <Di label="Ajustes">
          {d.totales.ajustesDebe > 0 || d.totales.ajustesHaber > 0
            ? `${money(d.totales.ajustesDebe)} al debe · ${money(d.totales.ajustesHaber)} al haber`
            : '—'}
        </Di>
        <Di label="Pagado">
          {d.totales.pagos > EPS ? `− ${money(d.totales.pagos)}` : '—'}
          {/* El flete va DENTRO de lo pagado, no se suma aparte: es lo que
              explica por qué a una factura de $100.000 se le pagaron $80.000. */}
          {d.totales.fletes > EPS && (
            <div className={s.hint} style={{ margin: 0 }}>
              de eso, {money(d.totales.fletes)} en fletes adelantados
            </div>
          )}
        </Di>
        {d.totales.paraCoffit > EPS && (
          <Di label="De eso, para Coffit (precio final)">
            {money(d.totales.paraCoffit)}
            <div className={s.hint} style={{ margin: 0 }}>ya está dentro de lo de arriba · Coffit te lo debe en su cuenta corriente</div>
          </Di>
        )}
        <Di label="Saldo"><Saldo valor={d.saldo}><strong>{money(d.saldo)}</strong></Saldo></Di>
      </div>
      {d.totales.gastos > EPS && (
        <div className={s.hint}>
          Este proveedor también factura <strong>gastos</strong>, y el saldo los incluye: la cuenta
          es <strong>una sola, la del proveedor</strong>. El detalle de esos gastos vive en el módulo Gastos.
        </div>
      )}

      {p.modoCuenta === 'libre' && d.deudaDesde && (
        <div className={cx(s.callout, s.info)}>
          Cuenta libre: lo pagado se aplica solo a lo más viejo que se le debe (FIFO), así que
          cada factura muestra lo que de verdad le falta. La deuda actual arrastra desde
          el <strong>{fmtFecha(d.deudaDesde)}</strong>.
        </div>
      )}

      {echeqs.length > 0 && (
        <>
          <div className={s['section-title']}>Echeqs que todavía no se debitaron</div>
          <div className={s.hint}>El saldo baja cuando el banco los debita y se marcan cobrados en Proveedores › Echeqs.</div>
          <Table cols={[{ h: 'Echeq' }, { h: 'Debita' }, { h: 'Importe', num: true }, { h: 'Cubre' }, { h: '' }]}>
            {echeqs.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.estado === 'pendiente' ? <EstadoEcheqPill estado={e.estado} /> : `N° ${e.numero}${e.banco ? ` · ${e.banco}` : ''}`}
                </td>
                <td>{fmtFecha(e.fechaVenc)} {enCartera(e) && <VencePill dias={e.diasRest} />}</td>
                <td className={s.num}>{money(e.importe)}</td>
                <td><EcheqCubre e={e} /></td>
                <td>
                  {enCartera(e) && (
                    <Btn small onClick={() => openModal('facturasEcheq', { echeq: e, onChange: refrescar })}>Facturas</Btn>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <div className={s['section-title']}>Movimientos ({d.movs.length})</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: 260 }}>
          {FILTROS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 150 }} />
        </label>
        <input
          type="search" placeholder="Buscar en el detalle…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ width: 220 }}
        />
        {hayFiltro && <Btn small onClick={limpiar}>Limpiar filtros</Btn>}
      </div>

      <Table
        cols={[
          { h: 'Fecha fc / pago' }, { h: 'Asentado' }, { h: 'Movimiento' }, { h: 'Debe', num: true },
          { h: 'Haber', num: true }, { h: 'Saldo', num: true }, { h: '' },
        ]}
        empty={hayFiltro ? 'Ningún movimiento con esos filtros.' : 'Todavía no hay movimientos.'}
        pag={pag}
      >
        {pag.visibles.map((m) => {
          const k = KIND[m.kind] ?? { label: m.kind, pill: null };
          const esAjuste = m.kind === 'ajuste_debe' || m.kind === 'ajuste_haber';
          const [tag, resto] = partirEtiqueta(m.etiqueta);
          return (
            <tr
              key={`${m.kind}-${m.id}`}
              {...(seAbre(m) && { className: s.clickable, title: 'Ver el comprobante', onClick: () => setVerComp(m.id) })}
            >
              {/* Solo el día, también en los pagos: el formulario manda la FECHA
                  y la API la guarda a medianoche, así que la hora sería un
                  "12:00 a. m." que no pasó. */}
              <td>{fmtFecha(m.fecha)}</td>
              {/* Cuándo se cargó en el sistema (5/11/2026). Los pagos anteriores al 5/11 no lo guardaban: «—». */}
              <td style={{ whiteSpace: 'nowrap' }} title="Cuándo se cargó en el sistema">{fechaAsentado(m.asentado)}</td>
              <td>
                <Pill pill={k.pill} label={m.kind === 'factura_mes' ? k.label : (tag || k.label)} /> {m.kind === 'factura_mes' ? m.etiqueta.replace(/^Factura /, '') : resto}
                {m.detalle && <div className={s.hint} style={{ margin: 0 }}>{m.detalle}</div>}
                {(m.formas?.length ?? 0) > 1 && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {m.formas.map((f) => `${MEDIOS_PAGO_REAL[f.medio] ?? f.medio}${f.cuentaPropiaNombre ? ` desde ${f.cuentaPropiaNombre}` : ''} ${money(f.importe)}`).join(' + ')}
                  </div>
                )}
                {/* Las transferencias de una cuenta disponible van juntas (23/10/2026): una por una, en su sección. */}
                {m.agrupado && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {[
                      'cada transferencia, con su cliente y su venta, en Proveedores › Cuentas disponibles',
                      m.sinAplicar > EPS ? `${money(m.sinAplicar)} sin aplicar` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                {m.kind === 'pago' && !m.agrupado && (
                  <div className={s.hint} style={{ margin: 0 }}>
                    {[
                      m.usuarioNombre ? `lo registró ${m.usuarioNombre}` : null,
                      m.sucursalNombre || null,
                      m.cuentaPropiaNombre ? `desde ${m.cuentaPropiaNombre}` : null,
                      m.cambioPor ? `efectivo por transferencia (${m.cambioPor})` : null,
                      m.cajaSesionId ? `turno #${m.cajaSesionId}` : 'no salió de caja',
                      m.referencia ? `ref. ${m.referencia}` : null,
                      m.sinAplicar > EPS ? `${money(m.sinAplicar)} sin aplicar` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                {m.saldoDoc > EPS && (
                  <div className={s.hint} style={{ margin: 0 }}>Queda debiendo {money(m.saldoDoc)}</div>
                )}
                {m.kind === 'comprobante' && <ConEcheq cubren={cubrenDe.get(m.id)} />}
                {m.paraCoffit > EPS && (
                  <div className={s.hint} style={{ margin: 0 }} title="El proveedor cobra la factura entera. Esta parte se la carga a Coffit en su cuenta corriente (Almacén › Coffit).">
                    ☕ {m.kind.startsWith('nc') ? 'Descuenta' : 'Incluye'} {money(m.paraCoffit)} {m.kind.startsWith('nc') ? 'de lo de' : 'para'} Coffit (precio final)
                  </div>
                )}
              </td>
              <td className={s.num}>{m.debe > 0 ? money(m.debe) : ''}</td>
              <td className={s.num}>{m.haber > 0 ? money(m.haber) : ''}</td>
              <td className={s.num}>{money(m.acumulado ?? 0)}</td>
              <td>
                {esAjuste && esJefe && <Btn small onClick={() => borrarAjuste(m)}>×</Btn>}
                {/* Anular solo si no tiene NADA aplicado: con imputaciones vivas
                    la API lo rechaza, y ofrecerlo sería un botón roto. */}
                {m.kind === 'pago' && !m.agrupado && esJefe && m.aplicado <= EPS && (
                  <Btn
                    small
                    onClick={() => openModal('anularPago', { pagoId: m.id, importe: m.haber, onChange: refrescar })}
                  >
                    Anular
                  </Btn>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {hayFiltro && (
        <div className={s.hint}>
          Del filtro: <strong>{money(totFiltro.debe)}</strong> al debe y{' '}
          <strong>{money(totFiltro.haber)}</strong> al haber en {filtrados.length} movimiento(s).
          La columna <strong>Saldo</strong> es el acumulado real de la cuenta, no del filtro.
        </div>
      )}

      <div className={s['section-title']}>Lo que le queda impago</div>
      <Table
        cols={[
          { h: 'Documento' }, { h: 'Fecha' }, { h: 'Vence' },
          { h: 'Total', num: true }, { h: 'Pagado', num: true }, { h: 'Saldo', num: true }, { h: '' },
        ]}
        empty="No le queda nada impago."
      >
        {docs.map((doc) => (
          <tr key={`${doc.tipo}-${doc.docId}`}>
            <td>
              {doc.etiqueta}
              {doc.detalle && <div className={s.hint} style={{ margin: 0 }}>{doc.detalle}</div>}
              {doc.tipo === 'comprobante' && <ConEcheq cubren={cubrenDe.get(doc.docId)} />}
              {!!doc.ajuste && (
                <div className={s.hint} style={{ margin: 0 }}>
                  {doc.ajuste > 0 ? 'Una ND le sumó ' : 'Una NC le restó '}
                  {money(Math.abs(doc.ajuste))}
                </div>
              )}
            </td>
            <td>{fmtFecha(doc.fecha)}</td>
            <td>
              {venceDoc(doc)
                ? <span style={venceDoc(doc) < hoyDia ? { color: 'var(--crm-color-danger)', fontWeight: 600 } : undefined}>
                    {fmtFecha(`${venceDoc(doc)}T00:00:00`)}
                  </span>
                : <span className={s.muted}>—</span>}
            </td>
            <td className={s.num}>{money(doc.total)}</td>
            <td className={s.num}>{doc.pagado > EPS ? money(doc.pagado) : '—'}</td>
            <td className={s.num}><strong>{money(doc.saldo)}</strong></td>
            <td>
              <Btn small variant="btn-primary" onClick={() => abrirPago([`${doc.tipo}-${doc.docId}`])}>
                Pagar
              </Btn>
            </td>
          </tr>
        ))}
      </Table>

      {(d.compromisos?.length ?? 0) > 0 && (
        <>
          <div className={s['section-title']}>Compromisos pendientes</div>
          <Table cols={[{ h: 'Vence' }, { h: 'Detalle' }, { h: 'Importe', num: true }]}>
            {d.compromisos.map((k) => (
              <tr key={k.id}>
                <td>{fmtFecha(k.fechaVenc)} <VencePill dias={k.diasRest} /></td>
                <td>
                  {k.echeqId ? (k.echeqEstado === 'pendiente' ? 'Echeq pendiente de confirmar' : `Echeq N° ${k.echeqNumero}`) : 'Cta cte'}
                  {k.comprobanteEtiqueta ? ` · ${k.comprobanteEtiqueta}` : ''}
                  {k.cuota ? ` · cuota ${k.cuota}/${k.cuotas}` : ''}
                  {k.obs && <div className={s.hint} style={{ margin: 0 }}>{k.obs}</div>}
                </td>
                <td className={s.num}><ImporteCompromiso k={k} /></td>
              </tr>
            ))}
          </Table>
          <div className={s.hint}>
            El compromiso se paga desde <strong>Cuentas corrientes</strong>, que es donde vive su
            vencimiento; el pago que se registre acá igual los cierra si deja la factura saldada.
          </div>
        </>
      )}

      {verComp != null && (
        <ModalDesdeAfuera
          tipo="comprobanteDetalle" props={{ id: verComp, soloLectura: true }}
          preparar={traerComp} onCerrar={cerrarComp}
        />
      )}

      {(d.cuentas?.length ?? 0) > 0 && (
        <>
          <div className={s['section-title']}>Cuentas bancarias</div>
          {d.cuentas.map((c) => (
            <div key={c.id} className={s.hint} style={{ margin: '2px 0' }}>
              <code>{c.cbuAlias}</code>{c.descripcion ? ` — ${c.descripcion}` : ''}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
