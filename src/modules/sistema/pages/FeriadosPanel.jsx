/**
 * SISTEMA › FERIADOS (0182, 19/10/2026, pedido del dueño)
 * ============================================================================
 * Los feriados y días no laborables de Formosa Capital del año elegido, y qué
 * hace cada sucursal ese día (abre o no, horario, nota). Desde acá se agregan,
 * se editan y se borran; «Traer feriados de AAAA» suma los nacionales del año
 * (ArgentinaDatos) y los de Formosa sin pisar lo que ya está. El aviso de toda
 * la app (FeriadosBanner) lee lo mismo. Ver crm-api/src/feriados.
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { errorMsg } from '@modules/ventas/services/ventas.api.js';
import { cx } from '@shared/utils/classNames.js';
import { ALCANCE_FERIADO, EVENTO_FERIADOS, TIPO_FERIADO, cuantoFalta, diaYFecha, diasHasta, queHace } from '@shared/utils/feriados.js';
import { PanelHead, Btn, s } from '@modules/productos/components/ui.jsx';
import { ModalShell } from '@modules/productos/components/Modal.jsx';

const NUEVO = { fecha: '', nombre: '', tipo: 'feriado', alcance: 'nacional', observaciones: '', sucursales: [] };
const colorQueHace = (c) => (!c ? 'var(--crm-color-text-muted)' : c.abre ? 'var(--crm-color-success)' : 'var(--crm-color-danger)');

export function FeriadosPanel({ onAviso }) {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useResource(`feriados:${anio}:${version}`, () => httpClient.get(`/feriados?anio=${anio}`));
  const [editando, setEditando] = useState(null);
  const [trayendo, setTrayendo] = useState(false);
  /* Los que ya pasaron quedan plegados: lo primero que se ve es el próximo. */
  const [verPasados, setVerPasados] = useState(false);
  const candado = useRef(false);
  const recargar = () => { setVersion((v) => v + 1); window.dispatchEvent(new Event(EVENTO_FERIADOS)); };

  const actual = new Date().getFullYear();
  const anios = [...new Set([...(data?.anios ?? []), actual, actual + 1, anio])].sort();
  const lista = data?.feriados ?? [];
  const hoy = data?.hoy;
  const proximoId = hoy ? lista.find((f) => diasHasta(f.fecha, hoy) >= 0)?.id : null;
  const pasados = hoy ? lista.filter((f) => diasHasta(f.fecha, hoy) < 0).length : 0;
  const visibles = verPasados ? lista : lista.filter((f) => !hoy || diasHasta(f.fecha, hoy) >= 0);

  const traer = async () => {
    if (candado.current) return;
    candado.current = true; setTrayendo(true);
    try {
      const r = await httpClient.post('/feriados/importar', { anio });
      onAviso({ tipo: 'ok', texto: r.agregados ? `Feriados de ${anio}: se agregaron ${r.agregados}${r.yaEstaban ? ` (${r.yaEstaban} ya estaban)` : ''}.` : `Feriados de ${anio}: ya estaban todos (${r.yaEstaban}).` });
      recargar();
    } catch (e) { onAviso({ tipo: 'err', texto: errorMsg(e) }); } finally { candado.current = false; setTrayendo(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelHead
        title="Feriados"
        desc="Los de Formosa Capital: nacionales, provinciales y municipales, y qué hace cada sucursal ese día. A administración le llega el aviso arriba de todo cuando falta poco."
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select id="feriados-anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Btn onClick={traer} disabled={trayendo} title="Los nacionales del año (ArgentinaDatos) y los de Formosa; lo que ya está no se toca.">
              {trayendo ? 'Trayendo…' : `Traer feriados de ${anio}`}
            </Btn>
            <Btn variant="btn-primary" onClick={() => setEditando({ ...NUEVO, fecha: `${anio}-01-01` })}>+ Agregar feriado</Btn>
          </div>
        )}
      />
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
      {loading && !data ? <div className={s.hint}>Cargando…</div> : !lista.length ? (
        <div className={cx(s.callout, s.info)}>No hay feriados cargados para {anio}. Tocá «Traer feriados de {anio}» o agregalos a mano.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pasados > 0 && (
            <div>
              <Btn small onClick={() => setVerPasados((v) => !v)}>
                {verPasados ? 'Ocultar los que ya pasaron' : `Ver los que ya pasaron (${pasados})`}
              </Btn>
            </div>
          )}
          {!visibles.length && <div className={s.hint} style={{ margin: 0 }}>Ya pasaron todos los de {anio}.</div>}
          {visibles.map((f) => {
            const paso = hoy && diasHasta(f.fecha, hoy) < 0;
            const config = new Map(f.sucursales.map((x) => [x.sucursalId, x]));
            return (
              <button
                key={f.id} type="button" onClick={() => setEditando(f)}
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'flex-start', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 10, color: 'var(--crm-color-text)', opacity: paso ? 0.55 : 1,
                  border: `${f.id === proximoId ? 2 : 1}px solid ${f.id === proximoId ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
                  background: 'var(--crm-color-surface)',
                }}
              >
                <div style={{ flex: '0 0 130px' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{diaYFecha(f.fecha)}</strong>
                  <div className={s.hint} style={{ margin: 0 }}>{hoy ? cuantoFalta(f.fecha, hoy) : ''}{f.id === proximoId ? ' · el próximo' : ''}</div>
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <strong>{f.nombre}</strong>
                  <div className={s.hint} style={{ margin: 0 }}>
                    {TIPO_FERIADO[f.tipo] ?? f.tipo} · {ALCANCE_FERIADO[f.alcance] ?? f.alcance}{f.observaciones ? ` · ${f.observaciones}` : ''}
                  </div>
                </div>
                <div style={{ flex: '1 1 260px', display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 13 }}>
                  {data.sucursales.map((su) => (
                    <span key={su.id} title={config.get(su.id)?.nota || undefined}>
                      {su.nombre}: <strong style={{ color: colorQueHace(config.get(su.id)) }}>{queHace(config.get(su.id))}</strong>
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editando && (
        <FeriadoModal
          feriado={editando} sucursales={data?.sucursales ?? []}
          onCerrar={() => setEditando(null)}
          onHecho={(texto) => { setEditando(null); onAviso({ tipo: 'ok', texto }); recargar(); }}
        />
      )}
    </div>
  );
}

/**
 * Alta o cambio de un feriado, con lo que hace cada sucursal (se guarda todo
 * junto). Borrar pide un segundo clic. Con candado (`useRef`).
 */
function FeriadoModal({ feriado, sucursales, onCerrar, onHecho }) {
  const [f, setF] = useState(() => ({ ...feriado }));
  /* sucursalId → '' (sin definir) | 'si' | 'no', con horario y nota. */
  const [porSuc, setPorSuc] = useState(() => Object.fromEntries(feriado.sucursales.map((x) => [x.sucursalId, { abre: x.abre ? 'si' : 'no', horario: x.horario, nota: x.nota }])));
  const [borrando, setBorrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const candado = useRef(false);
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const suc = (id, k, v) => setPorSuc((x) => ({ ...x, [id]: { abre: '', horario: '', nota: '', ...x[id], [k]: v } }));

  const ejecutar = async (fn, texto) => {
    if (candado.current) return;
    candado.current = true; setEnviando(true); setError('');
    try { await fn(); onHecho(texto); } catch (e) { setError(errorMsg(e)); } finally { candado.current = false; setEnviando(false); }
  };
  const guardar = () => {
    const cuerpo = {
      fecha: f.fecha, nombre: f.nombre, tipo: f.tipo, alcance: f.alcance, observaciones: f.observaciones,
      sucursales: Object.entries(porSuc).filter(([, x]) => x.abre)
        .map(([id, x]) => ({ sucursalId: Number(id), abre: x.abre === 'si', horario: x.abre === 'si' ? x.horario : '', nota: x.nota })),
    };
    ejecutar(() => (feriado.id ? httpClient.put(`/feriados/${feriado.id}`, cuerpo) : httpClient.post('/feriados', cuerpo)), `«${f.nombre.trim()}» guardado.`);
  };
  const borrar = () => {
    if (!borrando) { setBorrando(true); return; }
    ejecutar(() => httpClient.delete(`/feriados/${feriado.id}`), `«${feriado.nombre}» borrado.`);
  };

  return (
    <ModalShell
      title={feriado.id ? 'Feriado' : 'Agregar feriado'} size="md" onClose={enviando ? undefined : onCerrar}
      footer={[
        ...(feriado.id ? [{ texto: borrando ? 'Sí, borrarlo' : 'Borrar', clase: 'btn-delete', onClick: borrar, disabled: enviando }] : []),
        { texto: 'Cancelar', clase: 'btn-ghost', onClick: onCerrar, disabled: enviando },
        { texto: enviando ? 'Guardando…' : 'Guardar', clase: 'btn-primary', onClick: guardar, disabled: enviando || !f.fecha || !f.nombre.trim() },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className={s.field}><label htmlFor="feriado-fecha">Fecha</label><input id="feriado-fecha" type="date" value={f.fecha} onChange={campo('fecha')} /></div>
        <div className={s.field} style={{ gridColumn: '1 / -1' }}><label htmlFor="feriado-nombre">Nombre</label><input id="feriado-nombre" value={f.nombre} maxLength={120} onChange={campo('nombre')} placeholder="Día de la Soberanía Nacional" /></div>
        <div className={s.field}>
          <label htmlFor="feriado-tipo">Tipo</label>
          <select id="feriado-tipo" value={f.tipo} onChange={campo('tipo')}>{Object.entries(TIPO_FERIADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className={s.field}>
          <label htmlFor="feriado-alcance">Alcance</label>
          <select id="feriado-alcance" value={f.alcance} onChange={campo('alcance')}>{Object.entries(ALCANCE_FERIADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className={s.field} style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="feriado-obs">Observaciones</label>
          <input id="feriado-obs" value={f.observaciones} maxLength={500} onChange={campo('observaciones')} placeholder="Opcional: se paga doble, cierra el banco, etc." />
        </div>
      </div>

      <div className={s['section-title']} style={{ margin: '8px 0 0' }}>Qué hace cada sucursal</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {sucursales.map((su) => {
          const x = porSuc[su.id] ?? { abre: '', horario: '', nota: '' };
          return (
            <div key={su.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ flex: '0 0 130px' }}>{su.nombre}</strong>
              <select value={x.abre} onChange={(e) => suc(su.id, 'abre', e.target.value)} aria-label={`¿Abre ${su.nombre}?`} style={{ width: 'auto' }}>
                <option value="">Sin definir</option>
                <option value="si">Abre</option>
                <option value="no">No abre</option>
              </select>
              {x.abre === 'si' && (
                <input value={x.horario} maxLength={60} onChange={(e) => suc(su.id, 'horario', e.target.value)} placeholder="Horario: 9 a 13" aria-label={`Horario de ${su.nombre}`} style={{ width: 130 }} />
              )}
              {x.abre && (
                <input value={x.nota} maxLength={200} onChange={(e) => suc(su.id, 'nota', e.target.value)} placeholder="Nota (quién atiende, cómo fue…)" aria-label={`Nota de ${su.nombre}`} style={{ flex: '1 1 160px' }} />
              )}
            </div>
          );
        })}
      </div>
      {borrando && <div className={cx(s.callout, s.warn)}>Se borra el feriado y lo que se anotó de cada sucursal. Tocá «Sí, borrarlo» para confirmar.</div>}
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}
    </ModalShell>
  );
}
