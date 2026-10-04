/**
 * GERENCIA › CASH FLOW (4/10/2026, pedido del dueño) — PARTE 1
 * ============================================================================
 * La caja central de efectivo físico: lo que llega en los sobres de cada
 * cierre de caja de los locales y lo que se saca con un concepto (retiro,
 * depósito). Todo lo que mueve plata confirma dos veces; nada se borra, se
 * anula con motivo. Las reglas viven en el servidor (crm-api/src/cashflow);
 * acá solo se pide y se muestra.
 */
import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { money, num } from '@modules/productos/domain/format.js';
import { Table, PanelHead, Btn, Pill, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { useSegundaConfirmacion, AvisoSegundaConfirmacion, textoBoton } from '@modules/gastos/components/segundaConfirmacion.jsx';
import { Aviso, Bloque, Cargando, Grilla, Tile, Tiles } from '../metricas/piezas.jsx';
import { iso } from '../metricas/formato.js';

const hoy = () => iso(new Date());
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fechaCorta = (v) => (v ? new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fechaIso = (p) => (p ? `${p.slice(8, 10)}/${p.slice(5, 7)}/${p.slice(0, 4)}` : '—');
const ORIGEN = { saldo_inicial: 'Saldo inicial', sobre: 'Sobre de caja', concepto: 'Concepto', pago_proveedor: 'Pago a proveedor', gasto: 'Gasto', conteo: 'Conteo' };
const MEDIO = { efectivo: 'efectivo', deposito: 'depósito' };
/** Qué es cada movimiento, en una línea. */
const queEs = (m) => {
  if (m.origen === 'concepto') return m.concepto;
  if (m.origen === 'sobre') return `Sobre ${m.sucursal ?? ''}`;
  if (m.origen === 'pago_proveedor') return `Pago a ${m.proveedor ?? 'proveedor'} (${MEDIO[m.medio] ?? m.medio ?? ''})`;
  if (m.origen === 'gasto') return `Gasto: ${m.concepto ?? m.gastoDescripcion ?? ''}${m.gastoCategoria ? ` · ${m.gastoCategoria}` : ''}`;
  return ORIGEN[m.origen] ?? m.origen;
};
/** La diferencia, con su color: rojo faltó, verde sobró, gris nada. */
function Diferencia({ v }) {
  if (v == null) return <span className={s.muted}>—</span>;
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.009) return <span style={{ color: 'var(--crm-color-text-muted)' }}>sin diferencia</span>;
  return <strong style={{ color: n < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-primary)' }}>{n > 0 ? '+' : '−'}{money(Math.abs(n))}</strong>;
}
const Campo = ({ label, hint, children }) => (
  <div className={s.field}><label>{label}</label>{children}{hint && <div className={s.hint} style={{ margin: '6px 0 0' }}>{hint}</div>}</div>
);

/* ==================================================================== *
 * Arranque: desde qué día y con cuánto efectivo en mano
 * ==================================================================== */
function Arranque({ caja, onHecho, avisar, onCancelar }) {
  const [fecha, setFecha] = useState(caja?.fechaInicio ?? hoy());
  const [saldo, setSaldo] = useState(String(caja?.saldoInicial ?? ''));
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(`${fecha}|${saldo}`);
  const importe = Number(saldo);
  const guardar = () => sc.clic(
    () => {
      setError('');
      if (!fecha || fecha > hoy()) { setError('Elegí el día de arranque (hoy o anterior).'); return false; }
      if (!Number.isFinite(importe) || importe < 0) { setError('El saldo inicial tiene que ser un importe (puede ser 0).'); return false; }
      return true;
    },
    async () => {
      try {
        await httpClient.put('/cashflow/inicio', { fechaInicio: fecha, saldoInicial: importe, confirmado: true });
        avisar('ok', `Cash Flow en marcha desde el ${fechaIso(fecha)} con ${money(importe)} en mano.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <Bloque titulo={caja ? 'Cambiar el arranque' : 'Arrancar el Cash Flow'} sub="Contá el efectivo que tenés en la mano hoy: ese es el saldo inicial. Los sobres anteriores a la fecha no se piden controlar.">
      <div className={s['form-grid']}>
        <Campo label="Arranca el día"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Efectivo en mano ese día" hint="Lo que contaste, con billetes y monedas. Puede ser 0.">
          <input type="number" min="0" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0" />
        </Campo>
      </div>
      <AvisoSegundaConfirmacion {...sc}>
        El Cash Flow arranca el <strong>{fechaIso(fecha)}</strong> con <strong>{money(importe || 0)}</strong> en mano.
        {caja ? ' Esto reemplaza el arranque anterior.' : ''}
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="btn-primary" onClick={guardar}>{textoBoton(sc, caja ? 'Cambiar el arranque' : 'Arrancar', 'Sí, confirmar')}</Btn>
        {onCancelar && <Btn onClick={onCancelar}>Cancelar</Btn>}
      </div>
    </Bloque>
  );
}

/* ==================================================================== *
 * Resumen
 * ==================================================================== */
function Resumen({ d, irA, avisar, onHecho }) {
  const [cambiando, setCambiando] = useState(false);
  const negativo = d.saldo < -0.009;
  return (
    <>
      <Tiles>
        <Tile label="Efectivo en mano" valor={money(d.saldo)} alerta={negativo} detalle={negativo ? 'El saldo quedó en negativo: revisá los movimientos' : 'Sobres controlados + ingresos − egresos'} />
        <Tile label="En tránsito" valor={money(d.enTransito.total)} marca="#2563eb" detalle={d.enTransito.sobres ? `${d.enTransito.sobres} sobre${d.enTransito.sobres === 1 ? '' : 's'} sin controlar` : 'Ningún sobre pendiente'} />
        <Tile label={`Ingresos de ${d.mes.periodo.slice(5)}/${d.mes.periodo.slice(0, 4)}`} valor={money(d.mes.ingresos)} marca="var(--crm-color-primary)" detalle="sobres y otros ingresos" />
        <Tile label={`Egresos de ${d.mes.periodo.slice(5)}/${d.mes.periodo.slice(0, 4)}`} valor={money(d.mes.egresos)} marca="#dc2626" detalle="lo que salió de tu caja" />
      </Tiles>
      {d.enTransito.sobres > 0 && (
        <Aviso tono="info">
          Tenés <strong>{d.enTransito.sobres}</strong> sobre{d.enTransito.sobres === 1 ? '' : 's'} por <strong>{money(d.enTransito.total)}</strong> esperando que los cuentes.{' '}
          <Btn small variant="btn-primary" onClick={() => irA('sobres')}>Controlar sobres</Btn>
        </Aviso>
      )}
      <Grilla>
        <Bloque titulo="Últimos movimientos" acciones={<Btn small onClick={() => irA('movimientos')}>Ver todos</Btn>}>
          <TablaMovimientos filas={d.ultimos} compacta />
        </Bloque>
        <Bloque titulo="Arranque" sub={`Desde el ${fechaIso(d.caja.fechaInicio)} con ${money(d.caja.saldoInicial)} en mano.`}>
          {cambiando
            ? <Arranque caja={d.caja} avisar={avisar} onHecho={() => { setCambiando(false); onHecho(); }} onCancelar={() => setCambiando(false)} />
            : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div className={s.hint} style={{ margin: 0 }}>El arranque solo se cambia mientras no haya movimientos registrados. Después, el efectivo se corrige con un ingreso o un egreso con su motivo.</div>
                <div><Btn small onClick={() => setCambiando(true)}>Cambiar el arranque</Btn></div>
              </div>
            )}
        </Bloque>
      </Grilla>
    </>
  );
}

/* ==================================================================== *
 * Sobres
 * ==================================================================== */
function Billetes({ billetes }) {
  const filas = Object.entries(billetes || {}).map(([d, n]) => [Number(d), Number(n) || 0]).filter(([, n]) => n > 0).sort((a, b) => b[0] - a[0]);
  if (!filas.length) return <span className={s.muted}>Sin detalle de billetes.</span>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '2px 12px', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
      {filas.map(([d, n]) => (
        <span key={d} style={{ display: 'contents' }}>
          <span>{n} ×</span><span>{money(d)}</span><strong style={{ textAlign: 'right' }}>{money(d * n)}</strong>
        </span>
      ))}
    </div>
  );
}

function SobreModal({ sobre, soloVer, onCerrar, onHecho, avisar }) {
  const [contado, setContado] = useState(String(sobre.enviado));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const n = Number(contado);
  const diferencia = Number.isFinite(n) ? Math.round((n - sobre.enviado) * 100) / 100 : null;
  const hayDif = diferencia != null && Math.abs(diferencia) > 0.009;
  const sc = useSegundaConfirmacion(`${contado}|${motivo}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!Number.isFinite(n) || n < 0) { setError('Escribí cuánto contaste.'); return false; }
      if (hayDif && !motivo.trim()) { setError('Contaste distinto de lo enviado: escribí el motivo de la diferencia.'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post(`/cashflow/sobres/${sobre.cajaSesionId}/controlar`, { contado: n, motivo: motivo.trim(), confirmado: true });
        avisar('ok', `Sobre de ${sobre.sucursal} controlado: ${money(r.contado)} a tu caja. Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  const pagos = Array.isArray(sobre.pagosLocalDetalle) ? sobre.pagosLocalDetalle : [];
  return (
    <ModalShell
      title={soloVer ? `Sobre de ${sobre.sucursal}` : `Controlar el sobre de ${sobre.sucursal}`}
      subtitle={`Cierre del ${fechaHora(sobre.cierre)} · armó el sobre: ${sobre.cajero || '—'}`}
      onClose={onCerrar}
      footer={soloVer ? [{ texto: 'Cerrar', onClick: onCerrar }] : [
        { texto: 'Cancelar', onClick: onCerrar },
        { texto: textoBoton(sc, 'Controlar sobre', 'Sí, confirmar'), clase: 'btn-primary', onClick: confirmar },
      ]}
    >
      <div className={s['form-grid']}>
        <div>
          <div className={s['mini-label']}>Lo que dice el sobre</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(sobre.enviado)}</div>
          <Billetes billetes={sobre.billetesEnvio} />
        </div>
        <div>
          <div className={s['mini-label']}>El cierre del cajero</div>
          <div style={{ fontSize: 13, display: 'grid', gap: 2 }}>
            <span>Contó en el cajón: <strong>{money(sobre.contadoCajero)}</strong></span>
            <span>Esperado por el sistema: <strong>{money(sobre.esperadoCajero)}</strong> · <Diferencia v={sobre.diferenciaCajero} /></span>
            <span>Quedó de fondo: <strong>{money(sobre.fondoQueda)}</strong></span>
          </div>
        </div>
      </div>
      {pagos.length > 0 && (
        <div>
          <div className={s['mini-label']}>Pagos en efectivo que hizo el local en ese turno (informativo: no restan de tu caja)</div>
          <div style={{ display: 'grid', gap: 2, fontSize: 13 }}>
            {pagos.map((p, i) => <span key={i}>{p.motivo || 'Egreso'} · <strong>{money(p.importe)}</strong></span>)}
          </div>
        </div>
      )}
      {soloVer ? (
        <div className={cx(s.callout, s.info)}>
          Contaste <strong>{money(sobre.contado)}</strong> · <Diferencia v={sobre.diferencia} />
          {sobre.motivo && <> · motivo: {sobre.motivo}</>}
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Controlado por {sobre.controladoPor || '—'} el {fechaHora(sobre.controladoEn)}.</div>
        </div>
      ) : (
        <>
          <div className={s['form-grid']}>
            <Campo label="Cuánto contaste vos" hint="Abrí el sobre y contá. Si coincide, dejá el número como está.">
              <input type="number" min="0" step="0.01" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus />
            </Campo>
            <div>
              <div className={s['mini-label']}>Diferencia</div>
              <div style={{ fontSize: 18 }}><Diferencia v={diferencia} /></div>
              {hayDif && <div className={s.hint} style={{ margin: '4px 0 0' }}>{diferencia < 0 ? 'Falta plata en el sobre.' : 'Sobra plata en el sobre.'} Queda registrado con el cajero que lo armó.</div>}
            </div>
          </div>
          {hayDif && (
            <Campo label="Motivo de la diferencia *">
              <textarea rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: faltaba un billete de $1.000; el cajero avisó por WhatsApp" />
            </Campo>
          )}
          <AvisoSegundaConfirmacion {...sc}>
            Entra a tu caja <strong>{money(n || 0)}</strong> del sobre de <strong>{sobre.sucursal}</strong>
            {hayDif ? <> con una diferencia de <Diferencia v={diferencia} /></> : ' sin diferencia'}.
          </AvisoSegundaConfirmacion>
          {error && <Aviso tono="warn">{error}</Aviso>}
        </>
      )}
    </ModalShell>
  );
}

function AnularModal({ titulo, texto, ruta, onCerrar, onHecho, avisar, exito }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const sc = useSegundaConfirmacion(motivo);
  const confirmar = () => sc.clic(
    () => { setError(''); if (!motivo.trim()) { setError('Escribí el motivo.'); return false; } return true; },
    async () => {
      try {
        const r = await httpClient.post(ruta, { motivo: motivo.trim() });
        avisar('ok', `${exito} Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title={titulo} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, 'Anular', 'Sí, anular'), clase: 'btn-delete', onClick: confirmar },
    ]}>
      <div className={s.desc}>{texto} Queda registrado quién lo anuló, cuándo y por qué; no se borra.</div>
      <Campo label="Motivo *"><textarea rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Campo>
      <AvisoSegundaConfirmacion {...sc}>Se anula y el efectivo en mano se recalcula.</AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

function Sobres({ version, bump, avisar }) {
  const [estado, setEstado] = useState('pendientes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [modal, setModal] = useState(null);
  const qs = `estado=${estado}${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`;
  const { data, loading, error } = useResource(`cashflow:sobres:${qs}:${version}`, () => httpClient.get(`/cashflow/sobres?${qs}`));
  const filas = data ?? [];
  const total = filas.reduce((a, x) => a + (estado === 'controlados' ? x.contado : x.enviado), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="pendientes">Sin controlar</option>
          <option value="controlados">Controlados</option>
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        {(desde || hasta) && <Btn small onClick={() => { setDesde(''); setHasta(''); }}>Limpiar</Btn>}
        <span className={s.hint} style={{ margin: '0 0 0 auto' }}>{filas.length} sobre{filas.length === 1 ? '' : 's'} · {money(total)}</span>
      </div>
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !data ? <Cargando /> : (
        <Table
          cols={[
            { h: 'Cierre' }, { h: 'Sucursal' }, { h: 'Cajero' }, { h: 'Enviado', num: true }, { h: 'Pagó el local', num: true },
            ...(estado === 'controlados' ? [{ h: 'Contado', num: true }, { h: 'Diferencia', num: true }, { h: 'Controlado' }] : []),
            { h: 'Acciones', cls: 'actions-col' },
          ]}
          empty={estado === 'pendientes' ? 'No hay sobres sin controlar.' : 'Todavía no controlaste ningún sobre.'}
        >
          {filas.map((x) => (
            <tr key={x.cajaSesionId}>
              <td>{fechaHora(x.cierre)}</td>
              <td>{x.sucursal}</td>
              <td>{x.cajero || '—'}</td>
              <td className={s.num}><strong>{money(x.enviado)}</strong></td>
              <td className={s.num}>{x.pagosLocal > 0 ? <span title="Informativo: no resta de tu caja">{money(x.pagosLocal)}</span> : <span className={s.muted}>—</span>}</td>
              {estado === 'controlados' && (
                <>
                  <td className={s.num}>{money(x.contado)}</td>
                  <td className={s.num}><Diferencia v={x.diferencia} /></td>
                  <td><span title={fechaHora(x.controladoEn)}>{x.controladoPor || '—'}</span><div className={s.hint} style={{ margin: 0 }}>{fechaCorta(x.controladoEn)}</div></td>
                </>
              )}
              <td className={s['actions-col']}>
                <div className={s['row-actions']}>
                  {estado === 'pendientes'
                    ? <Btn variant="btn-primary" small onClick={() => setModal({ tipo: 'controlar', sobre: x })}>Controlar</Btn>
                    : (
                      <>
                        <Btn small onClick={() => setModal({ tipo: 'ver', sobre: x })}>Ver</Btn>
                        <Btn small variant="btn-delete" onClick={() => setModal({ tipo: 'deshacer', sobre: x })}>Deshacer</Btn>
                      </>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {modal?.tipo === 'controlar' && <SobreModal sobre={modal.sobre} onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar} />}
      {modal?.tipo === 'ver' && <SobreModal sobre={modal.sobre} soloVer onCerrar={() => setModal(null)} avisar={avisar} />}
      {modal?.tipo === 'deshacer' && (
        <AnularModal
          titulo={`Deshacer el control del sobre de ${modal.sobre.sucursal}`}
          texto={`El sobre del ${fechaCorta(modal.sobre.cierre)} vuelve a «sin controlar» y los ${money(modal.sobre.contado)} salen de tu efectivo en mano.`}
          ruta={`/cashflow/sobres/${modal.sobre.sobreId}/anular`}
          exito="Control deshecho: el sobre volvió a pendientes."
          onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar}
        />
      )}
    </div>
  );
}

/* ==================================================================== *
 * Movimientos
 * ==================================================================== */
function TablaMovimientos({ filas, compacta, onAnular }) {
  return (
    <Table
      cols={[{ h: 'Fecha' }, { h: 'Qué' }, ...(compacta ? [] : [{ h: 'Detalle' }, { h: 'Quién' }]), { h: 'Importe', num: true }, ...(onAnular ? [{ h: '', cls: 'actions-col' }] : [])]}
      empty="Sin movimientos."
    >
      {(filas ?? []).map((m) => {
        const anulado = !!m.anuladoEn;
        const que = queEs(m);
        return (
          <tr key={m.id} style={anulado ? { opacity: 0.55, textDecoration: 'line-through' } : undefined} title={anulado ? `Anulado por ${m.anuladoPor || '—'}: ${m.anuladoMotivo}` : undefined}>
            <td>{compacta ? fechaCorta(m.fecha) : fechaHora(m.fecha)}</td>
            <td>
              <Pill pill={m.tipo === 'ingreso' ? 'st-disponible' : 'st-comprometido'} label={m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} />{' '}{que}
              {m.origen === 'sobre' && m.sobreDiferencia != null && Math.abs(m.sobreDiferencia) > 0.009 && <> · <Diferencia v={m.sobreDiferencia} /></>}
              {compacta && m.detalle && <div className={s.hint} style={{ margin: 0 }}>{m.detalle}</div>}
            </td>
            {!compacta && <td>{m.detalle || <span className={s.muted}>—</span>}{anulado && <div className={s.hint} style={{ margin: 0, textDecoration: 'none' }}>Anulado: {m.anuladoMotivo}</div>}</td>}
            {!compacta && <td>{m.usuario || '—'}</td>}
            <td className={s.num} style={{ color: m.tipo === 'ingreso' ? 'var(--crm-color-primary)' : 'var(--crm-color-danger)', fontWeight: 700 }}>
              {m.tipo === 'ingreso' ? '+' : '−'}{money(m.importe)}
            </td>
            {onAnular && (
              <td className={s['actions-col']}>
                {!anulado && ['concepto', 'pago_proveedor', 'gasto'].includes(m.origen) && <Btn small variant="btn-delete" onClick={() => onAnular(m)}>Anular</Btn>}
              </td>
            )}
          </tr>
        );
      })}
    </Table>
  );
}

function MovimientoModal({ tipo, conceptos, onCerrar, onHecho, avisar }) {
  const opciones = conceptos.filter((c) => c.tipo === tipo && c.activo && (c.clase !== 'gasto' || c.gastoCategoriaId));
  const [conceptoId, setConceptoId] = useState(opciones[0]?.id ?? '');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const n = Number(importe);
  const concepto = opciones.find((c) => c.id === Number(conceptoId));
  const sc = useSegundaConfirmacion(`${conceptoId}|${importe}|${fecha}|${detalle}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!concepto) { setError('Elegí el concepto.'); return false; }
      if (!Number.isFinite(n) || n <= 0) { setError('Escribí el importe.'); return false; }
      if (!fecha || fecha > hoy()) { setError('La fecha tiene que ser hoy o anterior.'); return false; }
      return true;
    },
    async () => {
      try {
        const r = await httpClient.post('/cashflow/movimientos', { tipo, conceptoId: concepto.id, importe: n, fecha, detalle: detalle.trim(), confirmado: true });
        avisar('ok', `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado. Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title={tipo === 'ingreso' ? 'Registrar un ingreso de efectivo' : 'Sacar efectivo de la caja'} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso', 'Sí, confirmar'), clase: 'btn-primary', onClick: confirmar },
    ]}>
      {!opciones.length && <Aviso tono="warn">No hay conceptos de {tipo} activos. Crealos en la pestaña «Conceptos».</Aviso>}
      <div className={s['form-grid']}>
        <Campo label="Concepto *">
          <select value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
            {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.clase === 'gasto' ? ` (gasto · ${c.gastoCategoria})` : ''}</option>)}
          </select>
        </Campo>
        <Campo label="Importe *"><input type="number" min="0" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} autoFocus /></Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Fecha"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Detalle"><input maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Opcional: para qué, a quién" /></Campo>
      </div>
      <AvisoSegundaConfirmacion {...sc}>
        {tipo === 'ingreso' ? 'Entra' : 'Sale'} <strong>{money(n || 0)}</strong> {tipo === 'ingreso' ? 'a' : 'de'} tu caja por <strong>{concepto?.nombre ?? '—'}</strong> el {fechaIso(fecha)}.
        {concepto?.clase === 'gasto' && <> Se carga también como <strong>gasto pagado</strong> en Gastos ({concepto.gastoCategoria}).</>}
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/**
 * PAGO A PROVEEDOR DESDE LA CAJA (parte 2): se elige el proveedor, se tildan
 * las facturas (o los gastos cargados) que se pagan y con qué (efectivo o
 * depósito). Es el mismo pago de siempre: queda en la cuenta del proveedor.
 */
function PagoProveedorModal({ onCerrar, onHecho, avisar }) {
  const { data: provs } = useResource('cashflow:proveedores', () => httpClient.get('/cashflow/proveedores'));
  const [proveedorId, setProveedorId] = useState('');
  const [destino, setDestino] = useState('mercaderia');
  const [medio, setMedio] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [detalle, setDetalle] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [tildes, setTildes] = useState({}); // docId -> importe (string)
  const [error, setError] = useState('');
  const { data: docs, loading } = useResource(`cashflow:pend:${proveedorId}:${destino}`, () => httpClient.get(`/cashflow/proveedores/${proveedorId}/pendientes?destino=${destino}`), { enabled: !!proveedorId });
  const prov = (provs ?? []).find((p) => p.id === Number(proveedorId));
  const aplicado = Object.values(tildes).reduce((a, v) => a + (Number(v) || 0), 0);
  const extra = Number(aCuenta) || 0;
  const total = Math.round((aplicado + extra) * 100) / 100;
  const tildar = (d, on) => setTildes((t) => { const n = { ...t }; if (on) n[d.docId] = String(d.saldo); else delete n[d.docId]; return n; });
  const sc = useSegundaConfirmacion(`${proveedorId}|${destino}|${medio}|${referencia}|${fecha}|${detalle}|${aCuenta}|${JSON.stringify(tildes)}`);
  const confirmar = () => sc.clic(
    () => {
      setError('');
      if (!prov) { setError('Elegí el proveedor.'); return false; }
      if (total <= 0) { setError('Tildá qué pagás o escribí un importe a cuenta.'); return false; }
      for (const d of docs ?? []) {
        const v = Number(tildes[d.docId]);
        if (tildes[d.docId] != null && (!(v > 0) || v > d.saldo + 0.009)) { setError(`En ${d.etiqueta} el importe tiene que ser mayor a 0 y hasta ${money(d.saldo)}.`); return false; }
      }
      if (medio === 'deposito' && !referencia.trim()) { setError('Para un depósito escribí la referencia (número de depósito o comprobante del banco).'); return false; }
      return true;
    },
    async () => {
      try {
        const imputaciones = (docs ?? []).filter((d) => tildes[d.docId] != null).map((d) => ({ [d.tipo === 'gasto' ? 'gastoId' : 'comprobanteId']: d.docId, importe: Number(tildes[d.docId]) }));
        const r = await httpClient.post('/cashflow/pagos', { proveedorId: prov.id, destino, medio, importe: total, imputaciones, referencia: referencia.trim(), detalle: detalle.trim(), fecha, confirmado: true });
        avisar('ok', `Pago a ${prov.nombre} por ${money(total)} registrado. Efectivo en mano: ${money(r.saldo)}.`);
        onHecho();
      } catch (e) { setError(errorMsg(e)); }
    },
  );
  return (
    <ModalShell title="Pagar a un proveedor desde tu caja" subtitle="Queda en la cuenta del proveedor, aplicado a lo que tildes." wide onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: textoBoton(sc, `Pagar ${money(total)}`, 'Sí, confirmar el pago'), clase: 'btn-primary', onClick: confirmar, disabled: !prov },
    ]}>
      <div className={s['form-grid']}>
        <Campo label="Proveedor *">
          <select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setTildes({}); }} autoFocus>
            <option value="">— Elegí —</option>
            {(provs ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Qué pagás">
          <select value={destino} onChange={(e) => { setDestino(e.target.value); setTildes({}); }}>
            <option value="mercaderia">Facturas de mercadería</option>
            <option value="gastos">Gastos cargados en Gastos</option>
          </select>
        </Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Con qué">
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value="efectivo">Efectivo en mano</option>
            <option value="deposito">Depósito en su cuenta (sale efectivo de tu caja)</option>
          </select>
        </Campo>
        <Campo label={medio === 'deposito' ? 'Referencia del depósito *' : 'Referencia'}>
          <input maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={medio === 'deposito' ? 'Nº de depósito / comprobante' : 'Opcional'} />
        </Campo>
      </div>
      <div className={s['form-grid']}>
        <Campo label="Fecha"><input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Detalle"><input maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
      {prov && (
        <div>
          <div className={s['mini-label']}>{destino === 'gastos' ? 'Gastos que le debés' : 'Facturas que le debés'} — tildá las que pagás</div>
          {loading && !docs ? <Cargando /> : !(docs ?? []).length ? <div className={s.hint} style={{ margin: 0 }}>No le debés nada {destino === 'gastos' ? 'en gastos' : 'en facturas'}. Podés pagar a cuenta igual.</div> : (
            <Table cols={[{ h: '' }, { h: 'Documento' }, { h: 'Fecha' }, { h: 'Saldo', num: true }, { h: 'Pagás', num: true }]} empty="">
              {(docs ?? []).map((d) => {
                const on = tildes[d.docId] != null;
                return (
                  <tr key={`${d.tipo}${d.docId}`}>
                    <td><input type="checkbox" checked={on} onChange={(e) => tildar(d, e.target.checked)} aria-label={`Pagar ${d.etiqueta}`} /></td>
                    <td>{d.etiqueta}{d.detalle && <div className={s.hint} style={{ margin: 0 }}>{d.detalle}</div>}</td>
                    <td>{fechaCorta(d.fecha)}</td>
                    <td className={s.num}>{money(d.saldo)}</td>
                    <td className={s.num}>
                      {on && <input type="number" min="0" max={d.saldo} step="0.01" value={tildes[d.docId]} onChange={(e) => setTildes((t) => ({ ...t, [d.docId]: e.target.value }))} style={{ width: 120, textAlign: 'right' }} />}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      )}
      <div className={s['form-grid']}>
        <Campo label="Además, a cuenta (sin aplicar a un documento)" hint="Queda como saldo a favor en la cuenta del proveedor; se aplica después desde Proveedores.">
          <input type="number" min="0" step="0.01" value={aCuenta} onChange={(e) => setACuenta(e.target.value)} placeholder="0" />
        </Campo>
        <div>
          <div className={s['mini-label']}>Total del pago</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(total)}</div>
          <div className={s.hint} style={{ margin: 0 }}>aplicado {money(aplicado)} · a cuenta {money(extra)}</div>
        </div>
      </div>
      <AvisoSegundaConfirmacion {...sc}>
        Sale <strong>{money(total)}</strong> de tu caja para <strong>{prov?.nombre ?? '—'}</strong> ({MEDIO[medio]}), aplicado a {Object.keys(tildes).length} documento{Object.keys(tildes).length === 1 ? '' : 's'}{extra > 0 ? ` y ${money(extra)} a cuenta` : ''}.
      </AvisoSegundaConfirmacion>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

function Movimientos({ version, bump, avisar, conceptos }) {
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [anulados, setAnulados] = useState(false);
  const [modal, setModal] = useState(null);
  const qs = `${tipo ? `tipo=${tipo}&` : ''}${desde ? `desde=${desde}&` : ''}${hasta ? `hasta=${hasta}&` : ''}${anulados ? 'anulados=1&' : ''}`;
  const { data, loading, error } = useResource(`cashflow:mov:${qs}:${version}`, () => httpClient.get(`/cashflow/movimientos?${qs}`));
  const filas = data ?? [];
  const vivos = filas.filter((m) => !m.anuladoEn);
  const ingresos = vivos.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + m.importe, 0);
  const egresos = vivos.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + m.importe, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={s.toolbar}>
        <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Ingresos y egresos</option><option value="ingreso">Solo ingresos</option><option value="egreso">Solo egresos</option>
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={anulados} onChange={(e) => setAnulados(e.target.checked)} /> Ver anulados</label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="btn-ingreso" small onClick={() => setModal({ tipo: 'ingreso' })}>+ Ingreso</Btn>
          <Btn variant="btn-delete" small onClick={() => setModal({ tipo: 'egreso' })}>− Egreso</Btn>
          <Btn variant="btn-primary" small onClick={() => setModal({ tipo: 'pago' })}>Pagar a un proveedor</Btn>
        </div>
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        {vivos.length} movimiento{vivos.length === 1 ? '' : 's'} · ingresos {money(ingresos)} · egresos {money(egresos)} · neto {money(ingresos - egresos)}
        {filas.length >= 500 && ' · se muestran los últimos 500: acotá las fechas para ver más.'}
      </div>
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !data ? <Cargando /> : <TablaMovimientos filas={filas} onAnular={(m) => setModal({ tipo: 'anular', m })} />}
      {(modal?.tipo === 'ingreso' || modal?.tipo === 'egreso') && (
        <MovimientoModal tipo={modal.tipo} conceptos={conceptos} onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar} />
      )}
      {modal?.tipo === 'pago' && <PagoProveedorModal onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar} />}
      {modal?.tipo === 'anular' && (
        <AnularModal
          titulo={`Anular ${modal.m.tipo} de ${money(modal.m.importe)}`}
          texto={`${queEs(modal.m)} del ${fechaCorta(modal.m.fecha)}${modal.m.detalle ? ` (${modal.m.detalle})` : ''}.${modal.m.origen === 'pago_proveedor' ? ' El pago se desaplica de sus facturas y se anula en la cuenta del proveedor.' : modal.m.origen === 'gasto' ? ' El gasto y su pago se anulan también en Gastos.' : ''}`}
          ruta={`/cashflow/movimientos/${modal.m.id}/anular`}
          exito="Movimiento anulado."
          onCerrar={() => setModal(null)} onHecho={() => { setModal(null); bump(); }} avisar={avisar}
        />
      )}
    </div>
  );
}

/* ==================================================================== *
 * Conceptos
 * ==================================================================== */
function Conceptos({ conceptos, bump, avisar }) {
  const { data: rubros } = useResource('cashflow:rubros', () => httpClient.get('/cashflow/gasto-categorias'));
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('egreso');
  const [clase, setClase] = useState('movimiento');
  const [rubro, setRubro] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [error, setError] = useState('');
  const guardar = async (fn, ok) => {
    setError('');
    try { await fn(); avisar('ok', ok); bump(); } catch (e) { setError(errorMsg(e)); }
  };
  const crear = () => {
    if (!nombre.trim()) { setError('Escribí el nombre del concepto.'); return; }
    const esGasto = tipo === 'egreso' && clase === 'gasto';
    if (esGasto && !rubro) { setError('Elegí el rubro de Gastos al que va este concepto.'); return; }
    guardar(() => httpClient.post('/cashflow/conceptos', { nombre: nombre.trim(), tipo, clase: esGasto ? 'gasto' : 'movimiento', gastoCategoriaId: esGasto ? Number(rubro) : null }), `Concepto «${nombre.trim()}» creado.`).then(() => setNombre(''));
  };
  const grupos = [['egreso', 'Egresos (plata que sacás)'], ['ingreso', 'Ingresos (plata que entra, aparte de los sobres)']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bloque titulo="Nuevo concepto" sub="Un concepto es el motivo del movimiento. «Movimiento de plata» (retiro, depósito en el banco) no es un gasto del negocio; «Gasto» se carga también en Gastos, en su rubro, y entra en la rentabilidad.">
        <div className={s.toolbar}>
          <input value={nombre} maxLength={60} placeholder="Nombre del concepto" onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crear()} />
          <select className={s['select-inline']} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select>
          {tipo === 'egreso' && (
            <select className={s['select-inline']} value={clase} onChange={(e) => setClase(e.target.value)} aria-label="Clase">
              <option value="movimiento">Movimiento de plata (no es gasto)</option>
              <option value="gasto">Gasto del negocio (se carga en Gastos)</option>
            </select>
          )}
          {tipo === 'egreso' && clase === 'gasto' && (
            <select className={s['select-inline']} value={rubro} onChange={(e) => setRubro(e.target.value)} aria-label="Rubro">
              <option value="">— Rubro de Gastos —</option>
              {(rubros ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          )}
          <Btn variant="btn-primary" small onClick={crear}>Agregar</Btn>
        </div>
        {error && <Aviso tono="warn">{error}</Aviso>}
      </Bloque>
      {grupos.map(([t, titulo]) => (
        <Bloque key={t} titulo={titulo}>
          <Table cols={[{ h: 'Concepto' }, { h: 'Qué es' }, { h: 'Usos', num: true }, { h: 'Estado' }, { h: 'Acciones', cls: 'actions-col' }]} empty="Ninguno todavía.">
            {conceptos.filter((c) => c.tipo === t).map((c) => (
              <tr key={c.id} style={c.activo ? undefined : { opacity: 0.6 }}>
                <td>
                  {editando?.id === c.id ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <input value={editando.nombre} maxLength={60} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} autoFocus />
                      <Btn small variant="btn-primary" onClick={() => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { nombre: editando.nombre.trim() }), 'Concepto renombrado.').then(() => setEditando(null))}>Guardar</Btn>
                      <Btn small onClick={() => setEditando(null)}>Cancelar</Btn>
                    </span>
                  ) : c.nombre}
                </td>
                <td>
                  {c.clase === 'gasto' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Gasto ·
                      <select className={s['select-inline']} value={c.gastoCategoriaId ?? ''} onChange={(e) => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { gastoCategoriaId: e.target.value ? Number(e.target.value) : null }), 'Rubro cambiado.')} aria-label="Rubro">
                        <option value="">— sin rubro —</option>
                        {(rubros ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </span>
                  ) : c.tipo === 'egreso' ? 'Movimiento de plata' : 'Ingreso'}
                </td>
                <td className={s.num}>{num(c.usos, 0)}</td>
                <td><Pill pill={c.activo ? 'st-disponible' : 'st-retenido'} label={c.activo ? 'Activo' : 'Desactivado'} /></td>
                <td className={s['actions-col']}>
                  <div className={s['row-actions']}>
                    <Btn small onClick={() => setEditando({ id: c.id, nombre: c.nombre })}>Renombrar</Btn>
                    <Btn small onClick={() => guardar(() => httpClient.patch(`/cashflow/conceptos/${c.id}`, { activo: !c.activo }), c.activo ? 'Concepto desactivado: no se ofrece más, lo registrado queda.' : 'Concepto activado.')}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Bloque>
      ))}
    </div>
  );
}

/* ==================================================================== *
 * El panel
 * ==================================================================== */
const PESTANAS = [['resumen', 'Resumen'], ['sobres', 'Sobres de caja'], ['movimientos', 'Movimientos'], ['conceptos', 'Conceptos']];

export function CashFlowPanel() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const [pestana, setPestana] = useState('resumen');
  const [msg, setMsg] = useState(null);
  const avisar = (tono, texto) => setMsg({ tono, texto });
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  const { data: d, loading, error } = useResource(`cashflow:resumen:${version}`, () => httpClient.get('/cashflow/resumen'));
  const { data: conceptos } = useResource(`cashflow:conceptos:${version}`, () => httpClient.get('/cashflow/conceptos'));
  const abiertas = useMemo(() => d?.cajasAbiertas ?? [], [d]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead title="Cash Flow" desc="Tu caja central de efectivo: lo que llega en los sobres de los locales y lo que sacás. La suma de todo es lo que tenés en mano." />
      {msg && <Aviso tono={msg.tono === 'ok' ? 'info' : 'warn'}>{msg.texto}</Aviso>}
      {abiertas.length > 0 && (
        <Aviso tono="warn">
          <strong>Caja abierta hace más de 24 horas:</strong>{' '}
          {abiertas.map((c) => `${c.sucursal} (${c.usuario || 'sin usuario'}, desde el ${fechaHora(c.apertura)}, ${c.horas} h)`).join(' · ')}.
          {' '}Puede ser un cierre olvidado: hasta que cierren, el sobre no llega.
        </Aviso>
      )}
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !d ? <Cargando /> : !d ? null : !d.caja ? (
        <Arranque avisar={avisar} onHecho={bump} />
      ) : (
        <>
          <Tabs value={pestana} onChange={(e, v) => setPestana(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
            {PESTANAS.map(([id, label]) => <Tab key={id} value={id} label={id === 'sobres' && d.enTransito.sobres ? `${label} (${d.enTransito.sobres})` : label} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />)}
          </Tabs>
          {pestana === 'resumen' && <Resumen d={d} irA={setPestana} avisar={avisar} onHecho={bump} />}
          {pestana === 'sobres' && <Sobres version={version} bump={bump} avisar={avisar} />}
          {pestana === 'movimientos' && <Movimientos version={version} bump={bump} avisar={avisar} conceptos={conceptos ?? []} />}
          {pestana === 'conceptos' && <Conceptos conceptos={conceptos ?? []} bump={bump} avisar={avisar} />}
        </>
      )}
    </div>
  );
}
