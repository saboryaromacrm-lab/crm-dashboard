/**
 * CAJAS A CONTROLAR (0145, 8/10/2026, pedido del dueño)
 * ============================================================================
 * Al terminar un control —el sobre en el Cash Flow, el cierre del turno o un
 * control a mitad de turno en Ventas › Caja— el dueño ve la diferencia y, si
 * le parece mucha, tilda «Mandar a Cajas a controlar». Si no tilda nada, quedó
 * todo bien. Con la diferencia por encima de su límite el tilde viene puesto
 * (lo puede sacar). Solo el superadmin: la llave del Cash Flow.
 *
 * Acá viven el tilde (`TildeControlar`, con su estado en `tildeControlar.js`)
 * y la lista con «Resolver» (`CajasAControlar`). La lógica del servidor está
 * en crm-api/src/cashflow/a-controlar.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { money } from '@modules/productos/domain/format.js';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Aviso, Cargando } from '../metricas/piezas.jsx';
import { fechaHora } from './formato.js';

export function TildeControlar({ t }) {
  return (
    <div className={cx(s.callout, t.marcar ? s.warn : s.info)} style={{ margin: 0, display: 'grid', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
        <input type="checkbox" checked={t.marcar} onChange={(e) => t.setMarcar(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
        <span>
          Mandar a «Cajas a controlar»
          <span className={s.hint} style={{ display: 'block', margin: 0, fontWeight: 400 }}>
            {t.propuesto
              ? `La diferencia pasa de tu límite de ${money(t.umbral)}: te lo dejamos marcado. Si está todo bien, sacá el tilde.`
              : 'Tildalo si la diferencia te parece mucha: la caja queda en la lista del Cash Flow hasta que la resuelvas. Sin tilde, queda todo bien.'}
          </span>
        </span>
      </label>
      {t.marcar && (
        <input value={t.nota} maxLength={300} onChange={(e) => t.setNota(e.target.value)} aria-label="Nota para cuando la controles"
          placeholder="Nota para cuando la controles (opcional): «preguntarle a Carla», «revisar el egreso de las 18 h»…" />
      )}
    </div>
  );
}

/* ==================================================================== *
 * La lista
 * ==================================================================== */
const ORIGEN = { sobre: 'al controlar el sobre', cierre: 'al cerrar el turno', control: 'en un control a mitad de turno' };
const conSigno = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;

/** El lado derecho de un renglón: si no entra y baja (en el celular), sigue a la derecha. */
const Der = ({ children }) => <span style={{ marginLeft: 'auto', textAlign: 'right' }}>{children}</span>;

/** Una diferencia con su signo: − en rojo (faltó), + sobró, 0 «sin diferencia». */
function Dif({ v }) {
  if (v == null) return <Der><span className={s.muted}>—</span></Der>;
  if (Math.abs(v) < 0.5) return <Der><span className={s.muted}>sin diferencia</span></Der>;
  return <Der><strong style={{ color: v < 0 ? 'var(--crm-color-danger)' : 'var(--crm-color-text)', fontVariantNumeric: 'tabular-nums' }}>{conSigno(v)} {v < 0 ? 'faltó' : 'sobró'}</strong></Der>;
}

export function CajasAControlar({ version, bump, avisar, compacto = false }) {
  const [resueltas, setResueltas] = useState(false);
  const [resolviendo, setResolviendo] = useState(null);
  const { data, loading, error } = useResource(`cashflow:a-controlar:${resueltas}:${version}`,
    () => httpClient.get(`/cashflow/a-controlar${resueltas ? '?resueltas=1' : ''}`));
  const cajas = data?.cajas ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!compacto && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Qué cajas ver">
            <Btn small variant={resueltas ? 'btn-ghost' : 'btn-primary'} aria-pressed={!resueltas} onClick={() => setResueltas(false)}>Pendientes</Btn>
            <Btn small variant={resueltas ? 'btn-primary' : 'btn-ghost'} aria-pressed={resueltas} onClick={() => setResueltas(true)}>Resueltas</Btn>
          </div>
          {data && <Umbral actual={data.umbral} onHecho={bump} avisar={avisar} />}
        </div>
      )}
      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !data ? <Cargando /> : !cajas.length ? (
        <div className={cx(s.card, s.cardPad)} style={{ color: 'var(--crm-color-text-secondary)' }}>
          {resueltas ? 'Todavía no resolviste ninguna caja.' : 'No hay cajas para controlar. Cuando una diferencia te parezca mucha, tildá «Mandar a Cajas a controlar» al terminar el control.'}
        </div>
      ) : cajas.map((x) => <TarjetaCaja key={x.id} x={x} onResolver={() => setResolviendo(x)} />)}
      {resolviendo && (
        <ResolverModal caja={resolviendo} onCerrar={() => setResolviendo(null)} avisar={avisar}
          onHecho={() => { setResolviendo(null); bump(); }} />
      )}
    </div>
  );
}

/** Un turno marcado: de quién, cuándo, sus tres diferencias en vivo, la nota y qué se hizo. */
function TarjetaCaja({ x, onResolver }) {
  const abierta = x.estado === 'abierta';
  const fila = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' };
  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ ...fila, alignItems: 'baseline' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 15 }}>{x.sucursal || 'Sin local'} · {x.cajero || 'sin cajero'}</strong>
          <div className={s.hint} style={{ margin: 0 }}>
            Turno #{x.cajaSesionId} · {abierta ? `abierto desde el ${fechaHora(x.apertura)}` : `cerrado el ${fechaHora(x.cierre)}`}
            {' · '}marcada {ORIGEN[x.origen] ?? ''} el {fechaHora(x.marcadaEn)}
          </div>
        </div>
        {!x.resueltaEn && onResolver && <Btn small variant="btn-primary" onClick={onResolver}>Resolver</Btn>}
      </div>
      <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
        <div style={fila}>
          <span>Cierre del turno{!abierta && x.esperado != null ? ` (tenía que haber ${money(x.esperado)}, contó ${money(x.declarado)})` : ''}</span>
          {abierta ? <Der><span className={s.muted}>todavía abierto</span></Der> : <Dif v={x.difCierre} />}
        </div>
        <div style={fila}>
          <span>Sobre{x.sobreEnviado != null ? ` (decía ${money(x.sobreEnviado)}, contaste ${money(x.sobreContado)})` : ''}</span>
          {x.sobreEnviado != null ? <Dif v={x.difSobre} /> : <Der><span className={s.muted}>{abierta ? '—' : 'sin controlar'}</span></Der>}
        </div>
        {x.controles.map((c, i) => (
          <div key={i} style={fila}>
            <span>Control a mitad de turno, {fechaHora(c.fecha)}{c.nota ? ` · «${c.nota}»` : ''}</span>
            <Dif v={c.diferencia} />
          </div>
        ))}
      </div>
      {x.nota && <div style={{ fontSize: 13.5 }}>Tu nota: <em>{x.nota}</em></div>}
      {x.resueltaEn && (
        <div className={cx(s.callout, s.ok)} style={{ margin: 0 }}>
          <strong>Resuelta el {fechaHora(x.resueltaEn)}{x.resueltaPor ? ` por ${x.resueltaPor}` : ''}:</strong> {x.resolucion}
        </div>
      )}
    </div>
  );
}

/** Resolver: qué pasó con la caja. No mueve plata (la diferencia ya está registrada): cierra el seguimiento. */
function ResolverModal({ caja, onCerrar, onHecho, avisar }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  const guardar = async () => {
    if (candado.current) return;
    if (texto.trim().length < 3) { setError('Escribí qué pasó con esta caja.'); return; }
    candado.current = true; setEnviando(true); setError('');
    try {
      await httpClient.post(`/cashflow/a-controlar/${caja.id}/resolver`, { resolucion: texto.trim() });
      avisar('ok', `Caja de ${caja.sucursal || 'el local'} (turno #${caja.cajaSesionId}) resuelta.`);
      onHecho();
    } catch (e) { setError(errorMsg(e)); } finally { candado.current = false; setEnviando(false); }
  };
  return (
    <ModalShell title={`Resolver la caja de ${caja.sucursal || 'el local'}`} subtitle={`Turno #${caja.cajaSesionId} · ${caja.cajero || 'sin cajero'}`} onClose={onCerrar} footer={[
      { texto: 'Cancelar', onClick: onCerrar },
      { texto: enviando ? 'Guardando…' : 'Marcar como resuelta', clase: 'btn-primary', onClick: guardar, disabled: enviando },
    ]}>
      <div className={s.field} style={{ margin: 0 }}>
        <label htmlFor="cac-resolucion">¿Qué pasó? <span className={s.req}>*</span></label>
        <textarea id="cac-resolucion" rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus
          placeholder="Ej: apareció la plata en el cajón de abajo · un egreso que no se cargó · se le descuenta a Carla" />
      </div>
      <div className={s.hint} style={{ margin: 0 }}>Sale de la lista y queda en «Resueltas» con lo que escribiste. No mueve plata: la diferencia ya quedó registrada al contar.</div>
      {error && <Aviso tono="warn">{error}</Aviso>}
    </ModalShell>
  );
}

/** El límite de la propuesta, editable en el lugar. */
function Umbral({ actual, onHecho, avisar }) {
  const [valor, setValor] = useState(String(actual));
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false);
  useEffect(() => setValor(String(actual)), [actual]);
  const n = Number(valor);
  const valido = valor.trim() !== '' && Number.isFinite(n) && n >= 0;
  const guardar = async () => {
    if (candado.current || !valido || n === actual) return;
    candado.current = true; setEnviando(true);
    try {
      await httpClient.patch('/cashflow/a-controlar/umbral', { umbral: n });
      avisar('ok', `Listo: te propongo marcar las cajas con más de ${money(n)} de diferencia.`);
      onHecho();
    } catch (e) { avisar('error', errorMsg(e)); } finally { candado.current = false; setEnviando(false); }
  };
  return (
    <div className={s.field} style={{ margin: 0 }}>
      <label htmlFor="cac-umbral">Proponer el tilde cuando la diferencia pase de</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input id="cac-umbral" type="number" min="0" step="100" value={valor} onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }} style={{ width: 140 }} />
        <Btn small onClick={guardar} disabled={enviando || !valido || n === actual}>{enviando ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </div>
  );
}
