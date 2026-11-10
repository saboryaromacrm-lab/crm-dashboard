import { useRef, useState } from 'react';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg, provApi } from '../services/proveedores.api.js';
import {
  Btn, EcheqCubre, EstadoEcheqPill, PanelHead, Stat, Table, VencePill, fmtFecha, money, s,
} from '../components/ui.jsx';
import { isoDate } from '@modules/productos/domain/format.js';

const FILTROS = [
  ['activos', 'Activos'], ['pendientes', 'Pendientes de confirmar'], ['vencidos', 'Vencidos'], ['semana', 'Esta semana'],
  ['cobrados', 'Cobrados'], ['anulados', 'Anulados'], ['todos', 'Todos'],
];

const COLOR_HECHOS = 'var(--crm-color-primary)';
const COLOR_PENDIENTES = 'var(--crm-color-warning)';
const COLOR_COBRADOS = 'var(--crm-color-text-muted)';
const mesDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const nombreMes = (mes) => {
  const t = new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
/** Días de calendario de una fecha a otra (a mediodía: sin corrimientos de huso). */
const diasEntre = (a, b) => Math.round((Date.parse(`${isoDate(b)}T12:00:00`) - Date.parse(`${isoDate(a)}T12:00:00`)) / 86_400_000);

/**
 * DE QUÉ FECHA A QUÉ FECHA (7/11/2026, pedido del dueño): desde la emisión
 * —en el pendiente, la fecha de la factura que lo creó— hasta que debita, y
 * cuántos días son.
 */
function Plazo({ e }) {
  if (!e.fechaEmision) return null;
  const dias = diasEntre(e.fechaEmision, e.fechaVenc);
  return (
    <div className={s.hint} style={{ margin: 0 }} title={e.estado === 'pendiente' ? 'Desde la fecha de la factura' : 'Desde la fecha de emisión'}>
      {e.estado === 'pendiente' ? 'Factura del' : 'Del'} {fmtFecha(e.fechaEmision)} al {fmtFecha(e.fechaVenc)}
      {dias >= 0 && ` · ${cuantos(dias, 'día', 'días')}`}
    </div>
  );
}

const puntito = (color) => (
  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, marginRight: 4, flex: 'none' }} />
);

/** Cuándo, contado desde hoy: «hoy», «en 3 días» o lo atrasado, según la clase del renglón. */
function cuandoDebita({ dia, clase }) {
  if (clase === 'cobrado') return 'ya debitado';
  const d = diasEntre(new Date(), `${dia}T12:00:00`);
  if (d > 1) return `en ${d} días`;
  if (d === 1) return 'mañana';
  if (d === 0) return 'hoy';
  return `venció hace ${cuantos(-d, 'día', 'días')}${clase === 'pendiente' ? ', sin confirmar' : ', sin marcar cobrado'}`;
}

/**
 * EL MES DÍA POR DÍA (10/11/2026, pedido del dueño: «en cuántos días se cobraría
 * ese monto, como un resumen del mes, así veo cuáles faltan pagar»): cada día
 * de débito con cuánto sale, en cuántos días, y lo que ya se debitó este mes.
 */
function DiasDelMes({ dias }) {
  if (!dias?.length) return null;
  const color = { hecho: COLOR_HECHOS, pendiente: COLOR_PENDIENTES, cobrado: COLOR_COBRADOS };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', columnGap: 12, rowGap: 2, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
      {dias.map((d) => {
        const atrasado = d.clase !== 'cobrado' && diasEntre(new Date(), `${d.dia}T12:00:00`) < 0;
        const tono = d.clase === 'cobrado' ? { color: COLOR_COBRADOS } : atrasado ? { color: 'var(--crm-color-danger)' } : undefined;
        return (
          <div key={`${d.dia}-${d.clase}`} style={{ display: 'contents' }}>
            <span style={{ display: 'flex', alignItems: 'center', ...tono }}>
              {puntito(color[d.clase])}
              {new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short' })} {d.dia.slice(8)}/{d.dia.slice(5, 7)}
            </span>
            <span style={tono}>{cuandoDebita(d)}</span>
            <span className={s.hint} style={{ margin: 0 }}>
              {cuantos(d.n, d.clase === 'pendiente' ? 'pendiente' : 'echeq', d.clase === 'pendiente' ? 'pendientes' : 'echeqs')}
            </span>
            <span style={{ textAlign: 'right', ...tono, ...(d.clase === 'cobrado' && { textDecoration: 'line-through' }) }}>{money(d.monto)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * COMPROMETIDO POR MES (28/10/2026, pedido del dueño): lo que va a debitar cada
 * mes, con una barra que separa los hechos de los pendientes de confirmar. El
 * mes actual y el siguiente siempre a la vista; los que vienen, en un desplegable.
 */
function ComprometidoPorMes({ porMes = [] }) {
  const [abierto, setAbierto] = useState(false);
  const hoy = new Date();
  const actual = mesDe(hoy);
  const siguiente = mesDe(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1));
  const vacio = (mes) => ({ mes, hechos: { n: 0, monto: 0 }, pendientes: { n: 0, monto: 0 }, cobrados: { n: 0, monto: 0 }, atrasados: 0, dias: [] });
  const fijos = [actual, siguiente].map((m) => porMes.find((x) => x.mes === m) ?? vacio(m));
  const despues = porMes.filter((x) => x.mes > siguiente);
  const tope = Math.max(1, ...porMes.map((x) => x.hechos.monto + x.pendientes.monto));

  const fila = (x) => {
    const total = x.hechos.monto + x.pendientes.monto;
    return (
      <div key={x.mes} style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong>{nombreMes(x.mes)}{x.mes === actual && ' (este mes)'}</strong>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</strong>
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--crm-color-border)' }}>
          <div style={{ width: `${(x.hechos.monto / tope) * 100}%`, background: COLOR_HECHOS }} />
          <div style={{ width: `${(x.pendientes.monto / tope) * 100}%`, background: COLOR_PENDIENTES }} />
        </div>
        <div className={s.hint} style={{ margin: 0 }}>
          {total
            ? [
              x.hechos.n > 0 && `${cuantos(x.hechos.n, 'hecho', 'hechos')} · ${money(x.hechos.monto)}`,
              x.pendientes.n > 0 && `${cuantos(x.pendientes.n, 'pendiente de confirmar', 'pendientes de confirmar')} · ${money(x.pendientes.monto)}`,
            ].filter(Boolean).join(' — ')
            : 'Nada para debitar.'}
          {x.atrasados > 0 && ` — incluye ${cuantos(x.atrasados, 'echeq', 'echeqs')} de meses anteriores sin cobrar`}
          {x.cobrados?.n > 0 && ` — ya se ${x.cobrados.n === 1 ? 'debitó 1' : `debitaron ${x.cobrados.n}`} · ${money(x.cobrados.monto)}`}
        </div>
        <DiasDelMes dias={x.dias} />
      </div>
    );
  };

  return (
    <div className={s.card} style={{ padding: '12px 16px', marginBottom: 12, display: 'grid', gap: 12, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={s['mini-label']} style={{ margin: 0 }}>Comprometido por mes</span>
        <span className={s.hint} style={{ margin: 0, display: 'flex', gap: 12 }}>
          <span>{puntito(COLOR_HECHOS)}Hechos</span>
          <span>{puntito(COLOR_PENDIENTES)}Pendientes de confirmar</span>
          <span>{puntito(COLOR_COBRADOS)}Ya debitados</span>
        </span>
      </div>
      {fijos.map(fila)}
      {despues.length > 0 && (
        <>
          <Btn small onClick={() => setAbierto((a) => !a)} style={{ justifySelf: 'start' }}>
            {abierto ? 'Ocultar los meses siguientes' : `Ver ${cuantos(despues.length, 'mes más', 'meses más')} · ${money(despues.reduce((a, x) => a + x.hechos.monto + x.pendientes.monto, 0))}`}
          </Btn>
          {abierto && despues.map(fila)}
        </>
      )}
    </div>
  );
}

/**
 * ECHEQS — la cartera propia. Nacen con la factura del proveedor que cobra
 * así o con «Pagar con echeq» (proveedor y facturas en el mismo paso). El de
 * la factura espera PENDIENTE DE CONFIRMAR (0204), con tres salidas
 * (7/11/2026, pedido del dueño): «Hacer el echeq» (con el CUIT y el correo
 * para el home banking, y sus datos), «Pagar de otra forma» (el pago de
 * siempre con su factura tildada: al pagarla, el pendiente se da de baja solo)
 * o «No lo hice» (la deuda vuelve a Cuentas corrientes). «Facturas» imputa uno
 * hecho a una o varias (0205). "Cobrar" es EL momento contable: crea el pago
 * real, lo aplica a sus facturas y lo que sobra queda a cuenta.
 */
export function EcheqsPanel() {
  const { openModal, toast, recargarContadores } = useProveedores();
  const [filtro, setFiltro] = useState('activos');
  const [buscar, setBuscar] = useState('');
  const { data, reload } = useResource(
    `echeqs:${filtro}:${buscar}`,
    /* Arriba el próximo a debitarse; los que ya pasaron su fecha, al final (4/11/2026, pedido del dueño). */
    () => provApi.echeqs({ filtro, buscar: buscar || undefined, orden: 'proximos' }),
  );
  const { data: stats, reload: reloadStats } = useResource('echeqs-stats', provApi.statsEcheqs);

  const refrescar = () => { reload(); reloadStats(); recargarContadores(); };
  const abriendoPago = useRef(false);
  /* «Pagar de otra forma»: «Pagarle» con las facturas del pendiente ya tildadas. */
  const pagarDeOtraForma = async (e) => {
    if (abriendoPago.current) return;
    abriendoPago.current = true;
    try {
      const d = await provApi.edocProveedor(e.proveedorId);
      const preseleccion = e.facturas.map((x) => `comprobante-${x.comprobanteId}`);
      openModal('pagoProveedor', { proveedor: d.proveedor, docs: d.docsPendientes ?? [], preseleccion, saldo: d.saldo, onChange: refrescar });
    } catch (err) {
      toast(errorMsg(err), 'err');
    } finally { abriendoPago.current = false; }
  };
  const cambiarEstado = async (e, estado, aviso) => {
    if (estado === 'cobrado') {
      if (!window.confirm(`¿El banco debitó el echeq ${e.numero}? Esto registra el pago real al proveedor.`)) return;
    }
    if (estado === 'anulado') {
      const deuda = e.facturas.length ? ' Lo que cubría de sus facturas vuelve a Cuentas corrientes.' : '';
      if (!window.confirm(`¿Anular el echeq ${e.numero} por ${money(e.importe)}? Un echeq anulado no vuelve a la cartera.${deuda}`)) return;
    }
    try {
      await provApi.estadoEcheq(e.id, estado);
      toast(aviso, 'ok');
      refrescar();
    } catch (err) { toast(errorMsg(err), 'err'); }
  };
  const noSeHizo = async (e) => {
    if (!window.confirm(`¿No hiciste el echeq de ${money(e.importe)} a ${e.aNombreDe}? Se da de baja y la deuda vuelve a Cuentas corrientes.`)) return;
    try {
      await provApi.noSeHizoEcheq(e.id);
      toast('Listo: la deuda volvió a Cuentas corrientes.', 'ok');
      refrescar();
    } catch (err) { toast(errorMsg(err), 'err'); }
  };

  return (
    <div>
      <PanelHead
        title="Echeqs propios"
        desc="La cartera de echeqs propios. El que nace de una factura queda pendiente hasta que lo hagas (o la pagues de otra forma). Con «Facturas» uno hecho cubre una o varias. Cobrarlo registra el pago de verdad, imputado a sus facturas; lo que sobra queda a cuenta."
        actions={<Btn variant="btn-primary" onClick={() => openModal('echeq', { onChange: refrescar })}>+ Pagar con echeq</Btn>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Pendientes de confirmar" value={`${stats?.pendientes?.n ?? 0} · ${money(stats?.pendientes?.monto ?? 0)}`} accent={stats?.pendientes?.n ? 'accent-amber' : undefined} />
        <Stat label="En cartera (hechos)" value={`${stats?.activos?.n ?? 0} · ${money(stats?.activos?.monto ?? 0)}`} />
        <Stat label="Vencidos sin cobrar" value={`${stats?.vencidos?.n ?? 0} · ${money(stats?.vencidos?.monto ?? 0)}`} accent={stats?.vencidos?.n ? 'accent-red' : undefined} />
        <Stat label="Debitan en 3 días" value={`${stats?.prox3?.n ?? 0} · ${money(stats?.prox3?.monto ?? 0)}`} accent={stats?.prox3?.n ? 'accent-amber' : undefined} />
      </div>
      {stats && <ComprometidoPorMes porMes={stats.porMes} />}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map(([k, v]) => (
          <Btn key={k} small variant={filtro === k ? 'btn-primary' : undefined} onClick={() => setFiltro(k)}>{v}</Btn>
        ))}
        {/* Un solo buscador para escribir (4/11/2026, pedido del dueño: la lista de proveedores para
            elegir sobraba): encuentra por proveedor o a nombre de quien va, número, banco u observaciones. */}
        <input
          type="search" placeholder="Buscar proveedor, a nombre de, N° o banco…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} style={{ marginLeft: 'auto', minWidth: 280 }}
          aria-label="Buscar echeqs"
        />
      </div>

      <Table cols={[
        { h: 'Número' }, { h: 'Banco' }, { h: 'A nombre de' }, { h: 'Debita' },
        { h: 'Importe', num: true }, { h: 'Cubre' }, { h: 'Estado' }, { h: 'Acciones' },
      ]}>
        {(data?.filas ?? []).map((e) => {
          const activo = e.estado === 'emitido' || e.estado === 'entregado';
          const pendiente = e.estado === 'pendiente';
          return (
            <tr key={e.id}>
              <td>
                {pendiente ? '—' : (e.numero || '—')}
                {pendiente && <div className={s.hint} style={{ margin: 0 }}>todavía no confirmado</div>}
              </td>
              <td>{pendiente ? '—' : (e.banco || '—')}</td>
              <td>
                {e.aNombreDe}
                {!e.proveedorId && <div className={s.hint} style={{ margin: 0 }}>no es proveedor</div>}
              </td>
              <td>{fmtFecha(e.fechaVenc)} {(activo || pendiente) && <VencePill dias={e.diasRest} />}<Plazo e={e} /></td>
              <td className={s.num}>{money(e.importe)}</td>
              <td><EcheqCubre e={e} /></td>
              <td><EstadoEcheqPill estado={e.estado} dias={e.diasRest} /></td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pendiente && (
                    <>
                      <Btn small variant="btn-primary" onClick={() => openModal('confirmarEcheq', { echeq: e, onChange: refrescar })}>Hacer el echeq</Btn>
                      {e.proveedorId && e.facturas.length > 0 && (
                        <Btn small onClick={() => pagarDeOtraForma(e)} title="Transferencia u otro medio: al pagar la factura, este pendiente se da de baja solo">
                          Pagar de otra forma
                        </Btn>
                      )}
                      <Btn small onClick={() => noSeHizo(e)} title="La deuda vuelve a Cuentas corrientes">No lo hice</Btn>
                    </>
                  )}
                  {activo && (
                    <>
                      {/* El banco no lo debita antes de su fecha (27/9/2026): antes de
                          eso no se ofrece "Cobrar" — la API también lo rechaza. */}
                      {e.diasRest <= 0
                        ? <Btn small variant="btn-primary" onClick={() => cambiarEstado(e, 'cobrado', e.proveedorId ? 'Echeq cobrado: pago registrado.' : 'Echeq cobrado.')}>Cobrar</Btn>
                        : <span className={s.hint} style={{ margin: 0 }}>se cobra desde el {fmtFecha(e.fechaVenc)}</span>}
                      {e.estado === 'emitido' && (
                        <Btn small onClick={() => cambiarEstado(e, 'entregado', 'Marcado como entregado.')}>Entregado</Btn>
                      )}
                      {e.proveedorId && (
                        <Btn small onClick={() => openModal('facturasEcheq', { echeq: e, onChange: refrescar })}>Facturas</Btn>
                      )}
                      <Btn small onClick={() => openModal('echeq', { echeq: e, onChange: refrescar })}>Editar</Btn>
                      <Btn small onClick={() => cambiarEstado(e, 'anulado', 'Echeq anulado.')}>Anular</Btn>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      {!(data?.filas ?? []).length && <div className={s['empty-state']}>Sin echeqs en este filtro.</div>}
    </div>
  );
}
