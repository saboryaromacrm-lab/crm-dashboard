/**
 * TIENDA MINORISTA › BARRIOS Y ENVÍO (0185, 19/10/2026, pedido del dueño)
 * ============================================================================
 * Los barrios que dibuja el dueño (de a uno, cuando hace falta) con su costo
 * de envío, y las promos por barrio: envío gratis, envío a precio fijo o
 * descuento %, por días y fechas, con compra mínima. El cliente marca en el
 * mapa dónde recibe y el servidor decide el barrio; fuera de todo barrio rige
 * lo de siempre. Cada cambio guarda solo (no usa el «Guardar cambios» de arriba).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { httpClient } from '@core/services/httpClient.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, Table, s } from '@modules/productos/components/ui.jsx';
import { BarrioMapaModal } from './BarrioMapaModal.jsx';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
/** De lunes a domingo, como se lee una semana (0 = domingo, como el servidor). */
const SEMANA = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']];
const TIPOS = { envio_gratis: 'Envío gratis', envio_fijo: 'Envío a precio fijo', descuento: 'Descuento %' };

const PROMO_NUEVA = { barrioIds: [], tipo: 'envio_gratis', valor: 0, dias: [], desde: '', hasta: '', minimo: 0, activa: true };

function PromoModal({ promo, barrios, onGuardar, onBorrar, onCerrar }) {
  const [d, setD] = useState(() => ({ ...PROMO_NUEVA, ...promo, desde: promo?.desde ?? '', hasta: promo?.hasta ?? '' }));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const enVuelo = useRef(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const alternar = (k, v) => setD((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  const enviar = async (fn) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.data?.message || 'No se pudo guardar la promo.');
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  };
  const guardar = () => {
    if (!d.barrioIds.length) { setError('Elegí al menos un barrio.'); return; }
    enviar(() => onGuardar({
      barrioIds: d.barrioIds, tipo: d.tipo, valor: d.tipo === 'envio_gratis' ? 0 : Number(d.valor) || 0, dias: d.dias,
      desde: d.desde || null, hasta: d.hasta || null, minimo: Number(d.minimo) || 0, activa: d.activa,
    }));
  };
  const borrar = () => (borrando ? enviar(onBorrar) : setBorrando(true));

  return (
    <ModalShell
      title={promo ? 'Promo por barrio' : 'Nueva promo por barrio'}
      wide
      onClose={onCerrar}
      footer={[
        ...(promo ? [{ texto: borrando ? 'Sí, borrarla' : 'Borrar', clase: 'btn-delete', onClick: borrar, disabled: enviando }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar },
        { texto: enviando ? 'Guardando…' : 'Guardar promo', clase: 'btn-primary', onClick: guardar, disabled: enviando },
      ]}
    >
      <div className={s.field}>
        <label>Barrios</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
          {barrios.map((b) => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', opacity: b.activo ? 1 : 0.55 }}>
              <input type="checkbox" checked={d.barrioIds.includes(b.id)} onChange={() => alternar('barrioIds', b.id)} />
              {b.nombre}{!b.activo && ' (inactivo)'}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="promo-tipo">Qué da</label>
          <select id="promo-tipo" value={d.tipo} onChange={(e) => set('tipo')(e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {d.tipo !== 'envio_gratis' && (
          <div className={s.field}>
            <label htmlFor="promo-valor">{d.tipo === 'envio_fijo' ? 'Precio del envío ($)' : 'Descuento (%)'}</label>
            <input id="promo-valor" type="number" min="0" max={d.tipo === 'descuento' ? 100 : undefined} step={d.tipo === 'descuento' ? 1 : 100} value={d.valor} onChange={(e) => set('valor')(e.target.value)} />
          </div>
        )}
        <div className={s.field}>
          <label htmlFor="promo-minimo">Compra mínima ($)</label>
          <input id="promo-minimo" type="number" min="0" step="1000" value={d.minimo} onChange={(e) => set('minimo')(e.target.value)} />
        </div>
      </div>
      {d.tipo === 'descuento' && (
        <div className={s.hint} style={{ margin: 0 }}>
          Se descuenta de los productos que no están en oferta (como en la caja: una oferta y otro descuento no se suman). El envío no se descuenta.
        </div>
      )}
      <div className={s.field}>
        <label>Qué días</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEMANA.map(([dia, corto]) => (
            <Btn key={dia} small variant={d.dias.includes(dia) ? 'btn-primary' : 'btn-ghost'} onClick={() => alternar('dias', dia)} aria-pressed={d.dias.includes(dia)}>{corto}</Btn>
          ))}
        </div>
        <div className={s.hint} style={{ margin: '6px 0 0' }}>Sin ninguno marcado = todos los días.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className={s.field}>
          <label htmlFor="promo-desde">Desde (opcional)</label>
          <input id="promo-desde" type="date" value={d.desde} onChange={(e) => set('desde')(e.target.value)} />
        </div>
        <div className={s.field}>
          <label htmlFor="promo-hasta">Hasta (opcional)</label>
          <input id="promo-hasta" type="date" value={d.hasta} onChange={(e) => set('hasta')(e.target.value)} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={d.activa} onChange={(e) => set('activa')(e.target.checked)} />
        Activa (la tienda la aplica y la anuncia arriba el día que rige)
      </label>
      {borrando && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>Se borra la promo. Tocá «Sí, borrarla» para confirmar.</div>}
      {error && <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>{error}</div>}
    </ModalShell>
  );
}

export function BarriosEnvio({ mapsKey, avisar }) {
  const [datos, setDatos] = useState(null);
  /** Qué ventana está abierta: { barrio } (null = nuevo) o { promo }. */
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(() => httpClient.get('/web/barrios').then(setDatos), []);
  useEffect(() => {
    cargar().catch((e) => avisar('err', e?.data?.message || 'No se pudieron leer los barrios.'));
  }, [cargar, avisar]);

  /** Después de guardar o borrar: recarga, cierra y avisa. Si falla, la ventana queda abierta con el error. */
  const hecho = async (texto) => { await cargar(); setAbierto(null); avisar('ok', texto); };
  const guardarBarrio = (b) => async (dto) => {
    await (b ? httpClient.put(`/web/barrios/${b.id}`, dto) : httpClient.post('/web/barrios', dto));
    await hecho('Barrio guardado: la tienda lo usa desde ya.');
  };
  const guardarPromo = (p) => async (dto) => {
    await (p ? httpClient.put(`/web/barrios/promos/${p.id}`, dto) : httpClient.post('/web/barrios/promos', dto));
    await hecho('Promo guardada: la tienda la aplica desde ya.');
  };

  if (!datos) return <div className={s['empty-state']}>Cargando los barrios…</div>;

  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
      <div>
        <div className={s['section-title']} style={{ margin: 0 }}>Barrios y envío a domicilio</div>
        <div className={s.hint} style={{ margin: '4px 0 0' }}>
          El cliente marca en el mapa dónde recibe y la tienda sabe su barrio: le cobra el envío del barrio y le aplica sus promos.
          Fuera de todo barrio rige lo de siempre (el «envío gratis desde» o se coordina por WhatsApp). Dibujá los barrios a medida que los necesites.
          Cada cambio se guarda solo.
        </div>
      </div>
      {!mapsKey && (
        <div className={cx(s.callout, s.warn)} style={{ margin: 0 }}>
          Para dibujar barrios y que el cliente marque su casa en el mapa, cargá arriba la <strong>clave de Google Maps</strong> y guardá.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Barrios ({datos.barrios.length})</strong>
        <Btn small variant="btn-primary" onClick={() => setAbierto({ barrio: null })} disabled={!mapsKey}>+ Dibujar barrio</Btn>
      </div>
      <Table cols={[{ h: 'Barrio' }, { h: 'Envío', num: true }, { h: 'Estado' }, { h: '' }]} empty="Todavía no hay barrios dibujados.">
        {datos.barrios.map((b) => (
          <tr key={b.id}>
            <td><strong>{b.nombre}</strong></td>
            <td className={s.num}>{b.costoEnvio == null ? <span className={s.muted}>Se coordina</span> : b.costoEnvio === 0 ? 'Gratis' : pesos(b.costoEnvio)}</td>
            <td>{b.activo ? 'Activo' : <span className={s.muted}>Inactivo</span>}</td>
            <td style={{ textAlign: 'right' }}><Btn small onClick={() => setAbierto({ barrio: b })} disabled={!mapsKey}>Editar</Btn></td>
          </tr>
        ))}
      </Table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Promos por barrio ({datos.promos.length})</strong>
        <Btn small variant="btn-primary" onClick={() => setAbierto({ promo: null })} disabled={!datos.barrios.length}>+ Nueva promo</Btn>
      </div>
      <Table cols={[{ h: 'Promo' }, { h: 'Cuándo' }, { h: 'Estado' }, { h: '' }]} empty={datos.barrios.length ? 'Sin promos: «+ Nueva promo», por ejemplo envío gratis a un barrio los martes.' : 'Primero dibujá un barrio.'}>
        {datos.promos.map((p) => (
          <tr key={p.id}>
            <td>{p.texto}</td>
            <td>{p.cuando}</td>
            <td>{p.activa ? 'Activa' : <span className={s.muted}>Pausada</span>}</td>
            <td style={{ textAlign: 'right' }}><Btn small onClick={() => setAbierto({ promo: p })}>Editar</Btn></td>
          </tr>
        ))}
      </Table>
      <div className={s.hint} style={{ margin: 0 }}>
        Si un cliente cae en un barrio con varias opciones, gana lo más conveniente para él: el envío más barato y el descuento más alto (nunca se suman).
        Las promos del día se anuncian solas en la barra de arriba de la tienda.
      </div>

      {abierto && 'barrio' in abierto && (
        <BarrioMapaModal
          barrio={abierto.barrio}
          otros={datos.barrios.filter((b) => b.id !== abierto.barrio?.id)}
          mapsKey={mapsKey}
          onGuardar={guardarBarrio(abierto.barrio)}
          onBorrar={async () => { await httpClient.delete(`/web/barrios/${abierto.barrio.id}`); await hecho('Barrio borrado.'); }}
          onCerrar={() => setAbierto(null)}
        />
      )}
      {abierto && 'promo' in abierto && (
        <PromoModal
          promo={abierto.promo}
          barrios={datos.barrios}
          onGuardar={guardarPromo(abierto.promo)}
          onBorrar={async () => { await httpClient.delete(`/web/barrios/promos/${abierto.promo.id}`); await hecho('Promo borrada.'); }}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
