/**
 * GERENCIA › INDICADORES (0209, 1/11/2026)
 * ============================================================================
 * Pedido del dueño: «mostrarle datos a mi encargada pero sin montos, solo
 * porcentajes», con la explicación de cada uno, para qué sirve y qué objetivo
 * aplicar. La API (`/indicadores`) devuelve SOLO % (ver crm-api/src/indicadores):
 * esta pantalla no recibe un solo peso, así que no hay nada que esconder acá.
 *
 * Cada tarjeta: el valor, contra antes, el objetivo con su semáforo (con ícono
 * y palabra, no solo color) y «¿Qué es y para qué sirve?» desplegable. Los
 * objetivos los cambia solo el superadmin, desde «Editar objetivos».
 * 7/11/2026: «Contra el mismo período del mes anterior» (del 2 al 7 de noviembre
 * contra del 2 al 7 de octubre), con cualquier período de arriba.
 */
import { useMemo, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { cx } from '@shared/utils/classNames.js';
import { num } from '@modules/productos/domain/format.js';
import { Btn, PanelHead, s } from '@modules/productos/components/ui.jsx';
import { Barras, Columnas } from '../metricas/graficos.jsx';
import { DIAS_SEMANA, MEDIOS, PRESETS, fechaLarga, pctTxt, puntosTxt, rangoDe } from '../metricas/formato.js';
import { Aviso, Bloque, Cargando, Grilla } from '../metricas/piezas.jsx';
import { BLOQUES, INDICADORES, semaforo } from './catalogo.js';
import { DiasAbiertos } from '../DiasAbiertos.jsx';

/** Contra qué se compara (7/11/2026): los días justo antes, o los mismos días del mes anterior. */
const COMPARAR = { anterior: 'el período anterior', mes: 'el mismo período del mes anterior' };
const CONTRA_ANTERIOR = 'contra el período anterior';
const contraDe = (ind, d) => (ind.contra === CONTRA_ANTERIOR ? `contra ${COMPARAR[d.comparar] ?? COMPARAR.anterior}` : ind.contra);

const varTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${num(v, 1)}%`);
const pctFmt = (v) => `${num(v, 1)}%`;

const ESTADOS = {
  ok: { icono: '✓', texto: 'En objetivo', color: 'var(--crm-color-success)' },
  cerca: { icono: '!', texto: 'Cerca', color: 'var(--crm-color-warning, #b45309)' },
  fuera: { icono: '✕', texto: 'Fuera de objetivo', color: 'var(--crm-color-danger)' },
};

function Semaforo({ estado, sinDato }) {
  if (!estado) return <span className={s.badge} style={{ color: 'var(--crm-color-text-secondary)' }}>{sinDato ? 'Sin datos' : 'Sin objetivo'}</span>;
  const e = ESTADOS[estado];
  return (
    <span className={s.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--crm-color-text)', fontWeight: 600 }}>
      <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 9, background: e.color, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 11 }}>{e.icono}</span>
      {e.texto}
    </span>
  );
}

const objetivoTxt = (ind, obj) => {
  if (obj == null) return 'Sin objetivo cargado';
  const v = ind.formato === 'variacion' ? varTxt(obj) : pctTxt(obj);
  return ind.sentido === 'menor' ? `Objetivo: ${v} o menos` : `Objetivo: ${v} o más`;
};

function Tarjeta({ ind, d, objetivo, editando, borrador, setBorrador }) {
  const valor = d.valores[ind.id];
  const previo = ind.previo ? d.previos?.[ind.id] : undefined;
  const estado = semaforo(ind, valor, objetivo);
  const sinAnio = ind.id === 'crecimientoAnual' && d.detalle.anioPasadoSinDatos;
  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, boxSizing: 'border-box', borderLeft: estado ? `4px solid ${ESTADOS[estado].color}` : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className={s['mini-label']} style={{ margin: 0 }}>{ind.nombre}</div>
        <Semaforo estado={estado} sinDato={valor == null || sinAnio} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--crm-color-text)' }}>
        {sinAnio ? '—' : ind.formato === 'variacion' ? varTxt(valor) : pctTxt(valor)}
      </div>
      <div className={s.hint} style={{ margin: 0 }}>
        {sinAnio ? 'No hay ventas registradas de hace un año para comparar.'
          : ind.contra ? contraDe(ind, d)
          : previo != null ? <>Antes: {pctTxt(previo)} · {puntosTxt(valor != null ? valor - previo : null)}</>
          : ind.previo ? `Sin datos de ${COMPARAR[d.comparar] ?? COMPARAR.anterior} para comparar.` : null}
      </div>
      {ind.id === 'granel' && (
        <div className={s.hint} style={{ margin: 0 }}>
          Margen del granel <strong>{pctTxt(d.detalle.granelMargen)}</strong> · de los enteros <strong>{pctTxt(d.detalle.enterosMargen)}</strong>
        </div>
      )}
      {ind.id === 'cierresDiferencia' && <div className={s.hint} style={{ margin: 0 }}>Sobre {num(d.detalle.cierres, 0)} cierre(s) en el período.</div>}
      {ind.id === 'crecimientoPorDia' && (
        <div className={s.hint} style={{ margin: 0 }}>
          Abrió <strong>{d.detalle.actividad.abiertos}</strong> días contra {d.detalle.actividadAnterior.abiertos} del período con que se compara.
        </div>
      )}
      {editando ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Objetivo ({ind.sentido === 'menor' ? 'máximo' : 'mínimo'}) %
          <input
            id={`obj-${ind.id}`} type="number" step="0.1" style={{ width: 90 }}
            value={borrador[ind.id] ?? ''} placeholder={ind.objetivo == null ? '—' : String(ind.objetivo)}
            onChange={(ev) => setBorrador((b) => ({ ...b, [ind.id]: ev.target.value }))}
          />
        </label>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--crm-color-text-secondary)' }}>{objetivoTxt(ind, objetivo)}</div>
      )}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--crm-color-primary)' }}>¿Qué es y para qué sirve?</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>
          <div><strong>Qué es.</strong> {ind.que}</div>
          <div><strong>Para qué sirve.</strong> {ind.paraQue}</div>
          <div><strong>Si está mal.</strong> {ind.accion}</div>
        </div>
      </details>
    </div>
  );
}

const GrillaTarjetas = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 12 }}>{children}</div>
);

/** Las listas de reparto (sin objetivo): qué parte es cada una. */
function Repartos({ bloque, d }) {
  if (bloque === 'ventas') {
    return (
      <>
        <Grilla>
          <Bloque titulo="Participación de cada sucursal" sub={`Qué parte de la venta total hace cada local, y cuántos puntos ganó o perdió contra ${COMPARAR[d.comparar] ?? COMPARAR.anterior}`}>
            <Barras datos={d.sucursales.map((x) => ({ clave: x.id, etiqueta: x.nombre, valor: x.pct ?? 0, p: x.puntos }))} formato={pctFmt} sufijo={(x) => (x.p == null ? '' : `· ${puntosTxt(x.p)}`)} />
          </Bloque>
          <Bloque titulo="Medios de pago" sub="Qué parte de lo cobrado entró por cada medio">
            <Barras datos={d.medios.map((x) => ({ clave: x.medio, etiqueta: MEDIOS[x.medio] ?? x.medio, valor: x.pct ?? 0 }))} formato={pctFmt} />
          </Bloque>
        </Grilla>
        <Grilla>
          <Bloque titulo="A qué hora se vende" sub="Qué parte de los tickets entra en cada hora: para armar los turnos donde hay más gente">
            <Columnas
              titulo="Tickets por hora en %" alto={200} formato={pctFmt} eje={(v) => `${num(v, 0)}%`}
              datos={Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 6 || d.horas.some((x) => x.hora === h)).map((h) => {
                const x = d.horas.find((y) => y.hora === h);
                return { etiqueta: `${h}`, titulo: `${h}:00 a ${h}:59`, valor: x?.pct ?? 0 };
              })}
            />
          </Bloque>
          <Bloque titulo="Qué día de la semana" sub="Qué parte de la venta de una semana típica cae en cada día (promedio por día)">
            <Columnas
              titulo="Venta por día de la semana en %" alto={200} formato={pctFmt} eje={(v) => `${num(v, 0)}%`} etiquetaCada={1}
              datos={[1, 2, 3, 4, 5, 6, 7].map((dw) => ({ etiqueta: DIAS_SEMANA[dw], valor: d.dias.find((y) => y.dia === dw)?.pct ?? 0 }))}
            />
          </Bloque>
        </Grilla>
      </>
    );
  }
  if (bloque === 'rentabilidad') {
    const cats = d.categorias.slice(0, 12);
    return (
      <Grilla>
        <Bloque titulo="Margen por sucursal" sub="Lo que queda de cada $100 vendidos en cada local">
          <Barras datos={d.margenSucursales.map((x) => ({ clave: x.id, etiqueta: x.nombre, valor: x.margenPct ?? 0 }))} formato={pctFmt} />
        </Bloque>
        <Bloque titulo="Categorías: cuánto venden y cuánto dejan" sub={`Las ${cats.length} que más venden: parte de la venta · margen. Conviene empujar las de mejor margen.`}>
          <Barras datos={cats.map((x) => ({ clave: x.id, etiqueta: x.nombre, valor: x.pct ?? 0, m: x.margenPct }))} formato={pctFmt} sufijo={(x) => `· margen ${pctTxt(x.m)}`} />
        </Bloque>
      </Grilla>
    );
  }
  return null;
}

export function IndicadoresPanel() {
  const { can } = usePermissions();
  const puedeEditar = can('gerencia.indicadores_objetivos');
  const [preset, setPreset] = useState('mes-pasado');
  const [manual, setManual] = useState(() => rangoDe('mes-pasado'));
  const [desde, hasta] = preset === 'otro' ? manual : rangoDe(preset);
  const [sucursalId, setSucursalId] = useState('');
  const [comparar, setComparar] = useState('anterior');
  const qs = `desde=${desde}&hasta=${hasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}${comparar === 'mes' ? '&comparar=mes' : ''}`;

  const sucs = useResource('indicadores:sucursales', () => httpClient.get('/indicadores/sucursales'));
  const objs = useResource('indicadores:objetivos', () => httpClient.get('/indicadores/objetivos'));
  const { data: d, loading, error } = useResource(`indicadores:${qs}`, () => httpClient.get(`/indicadores?${qs}`));

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const objetivoDe = useMemo(() => {
    const guardados = objs.data ?? {};
    return (ind) => (guardados[ind.id] ?? ind.objetivo ?? null);
  }, [objs.data]);

  const empezar = () => {
    const b = {};
    for (const ind of INDICADORES) { const v = objs.data?.[ind.id]; if (v != null) b[ind.id] = String(v); }
    setBorrador(b); setEditando(true); setMsg(null);
  };
  const guardar = async () => {
    if (guardando) return;
    const objetivos = {};
    for (const ind of INDICADORES) {
      const t = String(borrador[ind.id] ?? '').trim().replace(',', '.');
      if (t === '') { objetivos[ind.id] = null; continue; }
      const n = Number(t);
      if (!Number.isFinite(n)) { setMsg({ tono: 'warn', texto: `El objetivo de «${ind.nombre}» no es un número.` }); return; }
      objetivos[ind.id] = n;
    }
    setGuardando(true);
    try {
      const r = await httpClient.put('/indicadores/objetivos', { objetivos });
      objs.mutate(r); setEditando(false); setMsg({ tono: 'ok', texto: 'Objetivos guardados.' });
    } catch (e) {
      setMsg({ tono: 'warn', texto: e?.data?.message || 'No se pudieron guardar los objetivos.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
      <PanelHead
        title="Indicadores"
        desc="Cómo va el negocio, todo en porcentajes: sin montos. Cada tarjeta dice qué es, para qué sirve, qué objetivo tiene y qué hacer si está fuera."
        actions={puedeEditar ? (
          editando ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="btn-ghost" onClick={() => setEditando(false)}>Cancelar</Btn>
              <Btn variant="btn-primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar objetivos'}</Btn>
            </div>
          ) : <Btn onClick={empezar} disabled={!objs.data}>Editar objetivos</Btn>
        ) : null}
      />
      {editando && <Aviso>Escribí el objetivo de cada indicador. Vacío = el valor de partida (el gris). Lo que guardes lo ve la encargada en cada tarjeta.</Aviso>}
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}

      <div className={s.toolbar} style={{ margin: 0 }}>
        <select className={s['select-inline']} value={preset} aria-label="Período"
          onChange={(ev) => { const v = ev.target.value; if (v === 'otro') setManual([desde, hasta]); setPreset(v); }}>
          {PRESETS.filter(([k]) => k !== 'hoy').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {preset === 'otro' && (
          <>
            <input type="date" value={manual[0]} max={manual[1]} onChange={(ev) => ev.target.value && setManual([ev.target.value, manual[1]])} aria-label="Desde" />
            <input type="date" value={manual[1]} min={manual[0]} onChange={(ev) => ev.target.value && setManual([manual[0], ev.target.value])} aria-label="Hasta" />
          </>
        )}
        <select className={s['select-inline']} value={sucursalId} onChange={(ev) => setSucursalId(ev.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {(sucs.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <select className={s['select-inline']} value={comparar} onChange={(ev) => setComparar(ev.target.value)} aria-label="Comparar con">
          {Object.entries(COMPARAR).map(([k, l]) => <option key={k} value={k}>Contra {l}</option>)}
        </select>
        <span className={s.hint} style={{ margin: 0 }}>{fechaLarga(desde)} → {fechaLarga(hasta)}</span>
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {!d && !error && <Cargando />}
      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-5, 20px)', opacity: loading ? 0.6 : 1 }}>
          <div className={s.hint} style={{ margin: 0 }}>
            «Contra {COMPARAR[d.comparar] ?? COMPARAR.anterior}» compara con {fechaLarga(d.anterior.desde)} → {fechaLarga(d.anterior.hasta)}.
            Las ventas son sin IVA y las notas de crédito restan. Los cálculos de stock son con la mercadería de hoy.
          </div>
          <DiasAbiertos a={d.detalle.actividad} />
          {BLOQUES.map((b) => (
            <section key={b.id} aria-labelledby={`bloque-${b.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <h3 id={`bloque-${b.id}`} style={{ margin: 0, fontSize: 18 }}>{b.titulo}</h3>
                <div className={s.hint} style={{ margin: 0 }}>{b.sub}</div>
              </div>
              <GrillaTarjetas>
                {INDICADORES.filter((x) => x.bloque === b.id).map((ind) => (
                  <Tarjeta key={ind.id} ind={ind} d={d} objetivo={objetivoDe(ind)} editando={editando} borrador={borrador} setBorrador={setBorrador} />
                ))}
              </GrillaTarjetas>
              <Repartos bloque={b.id} d={d} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
