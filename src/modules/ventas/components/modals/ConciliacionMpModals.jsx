/**
 * VENTAS › CONCILIACIÓN MP — las ventanas (18/11/2026).
 *
 *  · `CobroMp` / `PagoMp`: cómo se lee un cobro del ERP y un pago de Mercado
 *    Pago (lo usan el panel y estas ventanas).
 *  · `AtarMpModal`: atar a mano. Lo suelto de los dos lados alrededor del día
 *    (3 antes y 1 después: una transferencia llega antes); se tildan uno o
 *    varios de cada lado. Si no suman lo mismo, hay que decir por qué.
 *  · `ExplicarMpModal`: lo que queda de un solo lado. Plata que entró y no es
 *    una venta, o un cobro que no entró a Mercado Pago.
 *
 * Un cobro atado a UN pago toma el medio que dice Mercado Pago (la API lo
 * corrige y guarda el anterior): `cambioDeMedio` lo anuncia antes de confirmar.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { OPERACION_MP, TIPO_MP, nombreMp } from '@shared/utils/mercadoPago.js';
import { useVentas } from '../../context/VentasContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { ventasApi } from '../../services/ventas.api.js';
import { FAMILIA, MOTIVOS, alrededor, cambioDeMedio, comprobanteDe, nombreMedio } from '../../domain/conciliacionMp.js';
import { ModalShell, fmtFecha, fmtFechaHora, money, s } from '../ui.jsx';

const EPS = 0.009;
const suma = (lista, campo) => Math.round(lista.reduce((a, x) => a + x[campo], 0) * 100) / 100;

/** Un cobro del ERP: importe y medio; debajo cuándo, dónde, qué comprobante y quién. `onVer` abre el comprobante. */
export function CobroMp({ c, onVer }) {
  const comp = comprobanteDe(c);
  return (
    <div>
      <strong>{money(c.importe)}</strong> · {nombreMedio(c.medio)}
      {c.medioAnterior && <span className={s.muted}> (antes {nombreMedio(c.medioAnterior)}: lo corrigió Mercado Pago)</span>}
      <div className={s.hint} style={{ margin: 0 }}>
        {fmtFechaHora(c.fecha)} · {c.sucursal || '—'} ·{' '}
        {onVer ? <button type="button" className={s.linkBtn} onClick={onVer}>{comp}</button> : comp}
        {c.cajero ? ` · ${c.cajero}` : ''}{c.turno ? ` · turno #${c.turno}` : ''}
        {c.cliente && c.cliente !== 'Consumidor Final' ? ` · ${c.cliente}` : ''}
      </div>
    </div>
  );
}

/**
 * Un pago de Mercado Pago: importe y cómo entró; debajo cuándo, dónde, quién
 * pagó y su número. Lo que no pasó por el local (QR o Point) se nombra por la
 * operación: transferencia, ingreso de dinero, cobro, débito automático.
 */
export function PagoMp({ p }) {
  const { sucursales = [] } = useVentas();
  const suc = sucursales.find((x) => x.id === p.sucursalId)?.nombre;
  return (
    <div>
      <strong>{money(p.bruto)}</strong> · {p.familia === 'transferencia' && p.operacion ? nombreMp(OPERACION_MP, p.operacion) : FAMILIA[p.familia]}
      {p.tipo ? ` (${nombreMp(TIPO_MP, p.tipo)})` : ''}
      <div className={s.hint} style={{ margin: 0 }}>
        {[fmtFechaHora(p.fecha), suc, p.pagador, `N° ${p.id}`].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}

/** Una lista con casillas (cobros o pagos sueltos). */
function Elegir({ titulo, items, clave, elegidos, onCambio, render }) {
  return (
    <div>
      <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>{titulo}</div>
      {!items.length && <div className={s.hint} style={{ margin: 0 }}>Nada suelto en estos días.</div>}
      <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {items.map((x) => {
          const k = x[clave];
          return (
            <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={elegidos.has(k)} onChange={() => onCambio(k)} style={{ marginTop: 4 }} />
              {render(x)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function AtarMpModal({ dia, cobro, pago, onListo }) {
  const { closeModal, act } = useVentas();
  const rango = alrededor(dia);
  const { data, loading, error } = useResource(`conc-sueltos:${dia}`, () => ventasApi.conciliacionMpSueltos(rango));
  const [cobros, setCobros] = useState(() => new Set(cobro ? [cobro.clave] : []));
  const [pagos, setPagos] = useState(() => new Set(pago ? [pago.id] : []));
  const [buscar, setBuscar] = useState('');
  const [motivo, setMotivo] = useState('');

  /* Lo más parecido primero: el importe del que se eligió para empezar, después por cercanía en la hora. */
  const ref = cobro ?? pago;
  const refImporte = cobro?.importe ?? pago?.bruto ?? 0;
  const refHora = ref ? new Date(ref.fecha).getTime() : 0;
  const ordenar = (lista, campo) => [...lista].sort((a, b) => (Math.abs(a[campo] - refImporte) - Math.abs(b[campo] - refImporte))
    || (Math.abs(new Date(a.fecha) - refHora) - Math.abs(new Date(b.fecha) - refHora)));
  const filtro = buscar.trim().replace(/[.$\s]/g, '').replace(',', '.');
  const pasa = (importe, texto) => !filtro || String(importe).includes(filtro) || texto.toLowerCase().includes(buscar.trim().toLowerCase());
  const listaCobros = ordenar(data?.cobros ?? [], 'importe').filter((c) => cobros.has(c.clave) || pasa(c.importe, `${c.sucursal} ${c.cajero} ${c.cliente}`));
  const listaPagos = ordenar(data?.pagos ?? [], 'bruto').filter((p) => pagos.has(p.id) || pasa(p.bruto, p.pagador));

  const alternar = (set, setter) => (k) => setter(() => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const elegCobros = (data?.cobros ?? []).filter((c) => cobros.has(c.clave));
  const elegPagos = (data?.pagos ?? []).filter((p) => pagos.has(p.id));
  const dosLados = elegCobros.length > 0 && elegPagos.length > 0;
  const dif = Math.round((suma(elegCobros, 'importe') - suma(elegPagos, 'bruto')) * 100) / 100;
  const descuadra = dosLados && Math.abs(dif) > EPS;
  const listo = dosLados && (!descuadra || motivo.trim());
  const cambio = elegCobros.length === 1 && elegPagos.length === 1 ? cambioDeMedio(elegCobros[0], elegPagos[0]) : null;

  const atar = () => act(
    ventasApi.conciliacionMpAtar({ cobros: [...cobros], pagos: [...pagos], motivo: motivo.trim() || undefined }),
    cambio ? `Atado. El medio de la venta pasó a ${cambio.split(' → ')[1]}.` : 'Atado.',
    { recargar: false },
  ).then((ok) => { if (ok) onListo?.(); });

  return (
    <ModalShell
      title="Atar a mano"
      subtitle="Tildá el cobro (o los cobros) del ERP y el pago (o los pagos) de Mercado Pago que son lo mismo."
      wide
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Atar', clase: 'btn-primary', onClick: atar, disabled: !listo },
      ]}
    >
      {error && <div className={cx(s.callout, s.warn)}>{String(error)}</div>}
      <input type="search" placeholder="Buscar por importe, local o nombre…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {loading && !data ? <div className={s.hint}>Cargando lo suelto…</div> : (
        <>
          <Elegir titulo="Cobros del ERP sin pago" items={listaCobros} clave="clave" elegidos={cobros} onCambio={alternar(cobros, setCobros)} render={(c) => <CobroMp c={c} />} />
          <Elegir titulo="Pagos de Mercado Pago sin cobro" items={listaPagos} clave="id" elegidos={pagos} onCambio={alternar(pagos, setPagos)} render={(p) => <PagoMp p={p} />} />
        </>
      )}
      <div className={s.hint} style={{ margin: '8px 0 0' }}>
        Del {fmtFecha(`${rango.desde}T12:00:00`)} al {fmtFecha(`${rango.hasta}T12:00:00`)}.
        Cobros {money(suma(elegCobros, 'importe'))} · pagos {money(suma(elegPagos, 'bruto'))}
        {descuadra && <strong style={{ color: 'var(--crm-color-danger)' }}> · diferencia {money(dif)}</strong>}
      </div>
      {cambio && (
        <div className={cx(s.callout, s.info)} style={{ margin: '8px 0 0' }}>
          Mercado Pago dice que se cobró con otro medio: al atar, la venta pasa de <strong>{cambio}</strong>. El importe no cambia; «Deshacer» lo vuelve atrás.
        </div>
      )}
      {descuadra && (
        <div className={s.field}>
          <label htmlFor="conc-motivo">No suman lo mismo: ¿por qué? <span className={s.req}>*</span></label>
          <input id="conc-motivo" maxLength={200} placeholder="Por ejemplo: se tipeó mal el monto en el Point" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      )}
    </ModalShell>
  );
}

export function ExplicarMpModal({ tipo, cobro, pago, onListo }) {
  const { closeModal, act } = useVentas();
  const opciones = MOTIVOS[tipo];
  const [eleccion, setEleccion] = useState(opciones[0]);
  const [otro, setOtro] = useState('');
  const motivo = eleccion === 'otro' ? otro.trim() : eleccion;

  const guardar = () => act(
    ventasApi.conciliacionMpAtar(tipo === 'sin_mp' ? { cobros: [cobro.clave], motivo } : { pagos: [pago.id], motivo }),
    tipo === 'sin_mp' ? 'Anotado: ese cobro no entró a Mercado Pago.' : 'Anotado: esa plata no es una venta.',
    { recargar: false },
  ).then((ok) => { if (ok) onListo?.(); });

  return (
    <ModalShell
      title={tipo === 'sin_mp' ? 'Este cobro no entró a Mercado Pago' : 'Esta plata no es una venta'}
      onClose={closeModal}
      footer={[
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: closeModal },
        { texto: 'Guardar', clase: 'btn-primary', onClick: guardar, disabled: !motivo },
      ]}
    >
      {tipo === 'sin_mp' ? <CobroMp c={cobro} /> : <PagoMp p={pago} />}
      <div className={s.field}>
        <label htmlFor="conc-explicar">{tipo === 'sin_mp' ? '¿Qué pasó?' : '¿Qué es?'}</label>
        <select id="conc-explicar" value={eleccion} onChange={(e) => setEleccion(e.target.value)}>
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="otro">Otra cosa…</option>
        </select>
      </div>
      {eleccion === 'otro' && (
        <div className={s.field}>
          <label htmlFor="conc-otro">Contalo <span className={s.req}>*</span></label>
          <input id="conc-otro" autoFocus maxLength={200} value={otro} onChange={(e) => setOtro(e.target.value)} />
        </div>
      )}
      <div className={s.hint}>
        Queda con tu nombre y la hora, y sale de la lista de pendientes. Se puede deshacer desde «Ya atados».
      </div>
    </ModalShell>
  );
}
