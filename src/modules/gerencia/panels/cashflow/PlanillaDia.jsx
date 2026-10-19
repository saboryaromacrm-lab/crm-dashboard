/**
 * LA PLANILLA DE CAJAS DEL DÍA (19/10/2026, pedido del dueño)
 * ============================================================================
 * «¿Cómo sé cuándo me falta una caja que cierren y me rindan?» De un vistazo:
 * cada local, sus turnos de ese día y en qué quedó cada uno — abierta, sin
 * rendir (el sobre todavía no se controló), rendida, cerrada sin sobre — y los
 * locales que no abrieron caja. Una caja abierta de un día anterior aparece
 * también hoy, marcada en rojo: es el cierre olvidado.
 *
 * La regla de cada estado vive en el servidor (crm-api/src/cashflow/planilla.ts),
 * la misma que Sobres y «En tránsito». Va en la PC (pestaña) y en el celular
 * (Inicio), por eso no depende de los estilos de ninguna de las dos.
 */
import { httpClient } from '@core/services/httpClient.js';
import { useResource } from '@modules/ventas/hooks/useResource.js';
import { money } from '@modules/productos/domain/format.js';
import { s } from '@modules/productos/components/ui.jsx';
import { Aviso, Cargando } from '../metricas/piezas.jsx';
import { fechaIso, horaCorta, hoy } from './formato.js';

/** Cómo se ve cada estado: texto y color (tokens del tema, andan en claro y en oscuro). */
const ESTADOS = {
  abierta: { texto: 'Abierta', color: 'var(--crm-color-info)' },
  sin_rendir: { texto: 'Sin rendir', color: 'var(--crm-color-warning)' },
  rendida: { texto: 'Rendida', color: 'var(--crm-color-success)' },
  no_corresponde: { texto: 'No corresponde', color: 'var(--crm-color-text-secondary)' },
  sin_sobre: { texto: 'Cerró sin sobre', color: 'var(--crm-color-text-secondary)' },
  previo: { texto: 'Antes del Cash Flow', color: 'var(--crm-color-text-secondary)' },
};
const ROJO = 'var(--crm-color-danger)';

/** Un día más o menos, en el calendario (mediodía: sin saltos por horario de verano). */
const otroDia = (dia, delta) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('sv-SE');
};
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const nombreDia = (dia) => `${DIAS[new Date(`${dia}T12:00:00`).getDay()]} ${fechaIso(dia)}`;

function Pastilla({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
    }}
    >
      {children}
    </span>
  );
}

/** Un número del resumen de arriba; con `alerta`, en color cuando hay algo. */
function Cuenta({ n, texto, detalle, alerta }) {
  const color = alerta && n > 0 ? alerta : 'var(--crm-color-text)';
  return (
    <div style={{ flex: '1 1 120px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface)' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{texto}</div>
      {detalle && <div className={s.hint} style={{ margin: 0 }}>{detalle}</div>}
    </div>
  );
}

/** Un turno: cuándo y quién a la izquierda; en qué quedó y la plata a la derecha. */
function Turno({ t, onControlar }) {
  const e = ESTADOS[t.estado] ?? { texto: t.estado, color: 'var(--crm-color-text-secondary)' };
  const olvidada = t.estado === 'abierta' && t.deOtroDia;
  const dif = t.estado === 'rendida' ? t.diferenciaSobre : t.diferenciaCajero;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', padding: '8px 0', borderTop: '1px solid var(--crm-color-border)' }}>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <strong style={{ textTransform: 'capitalize' }}>{t.turno}</strong>
        <span className={s.muted}>
          {' · '}{olvidada ? `desde el ${fechaIso(t.deOtroDia)} ${horaCorta(t.apertura)}` : horaCorta(t.apertura)}
          {t.cierre ? ` → ${horaCorta(t.cierre)}` : ''}
          {t.cajero ? ` · ${t.cajero}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
        {t.aControlar && <Pastilla color={ROJO}>A controlar</Pastilla>}
        <Pastilla color={olvidada ? ROJO : e.color}>{olvidada ? 'Abierta: no cerró' : e.texto}</Pastilla>
        {t.envio > 0 && (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {money(t.envio)}
            {dif != null && Math.abs(dif) >= 0.5 && (
              <span style={{ color: dif < 0 ? ROJO : 'var(--crm-color-text-secondary)', fontWeight: 600 }}>
                {' '}({dif < 0 ? '−' : '+'}{money(Math.abs(dif))} {dif < 0 ? 'faltó' : 'sobró'})
              </span>
            )}
          </span>
        )}
        {t.estado === 'sin_rendir' && onControlar && (
          <button type="button" onClick={onControlar} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--crm-color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Controlar sobre ›
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * `dia` / `setDia`: el día que se mira (lo maneja quien la muestra, así el
 * celular la recuerda al cambiar de pestaña). `onControlar`: lleva a Sobres.
 */
export function PlanillaDia({ dia, setDia, version, onControlar }) {
  const hoyDia = hoy();
  const { data: p, loading, error } = useResource(`cashflow:planilla:${dia}:${version}`, () => httpClient.get(`/cashflow/planilla?dia=${dia}`));
  const esHoy = dia === hoyDia;
  const r = p?.resumen;
  const boton = { font: 'inherit', fontSize: 18, lineHeight: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface)', color: 'var(--crm-color-text)', cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={boton} onClick={() => setDia(otroDia(dia, -1))} aria-label="Día anterior">‹</button>
        <input type="date" value={dia} max={hoyDia} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Día de la planilla" style={{ width: 'auto' }} />
        <button type="button" style={{ ...boton, opacity: esHoy ? 0.4 : 1 }} disabled={esHoy} onClick={() => setDia(otroDia(dia, 1))} aria-label="Día siguiente">›</button>
        {!esHoy && <button type="button" style={{ ...boton, fontSize: 14 }} onClick={() => setDia(hoyDia)}>Hoy</button>}
        <strong style={{ textTransform: 'capitalize' }}>{esHoy ? 'Hoy' : nombreDia(dia)}</strong>
      </div>

      {error && <Aviso tono="warn">{error}</Aviso>}
      {loading && !p ? <Cargando /> : p && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Cuenta n={r.sinRendir} texto="Sin rendir" detalle={r.sinRendir ? `${money(r.sinRendirTotal)} en sobres` : 'Nada pendiente'} alerta="var(--crm-color-warning)" />
            <Cuenta
              n={r.abiertas}
              texto={r.abiertas === 1 ? 'Abierta' : 'Abiertas'}
              detalle={r.olvidadas ? `${r.olvidadas} de otro día: no cerraron` : esHoy ? 'Todavía no cerraron' : 'No cerraron'}
              alerta={esHoy && !r.olvidadas ? 'var(--crm-color-info)' : ROJO}
            />
            <Cuenta n={r.rendidas} texto={r.rendidas === 1 ? 'Rendida' : 'Rendidas'} detalle="Sobre controlado" />
            <Cuenta n={r.sinCaja} texto="Sin caja" detalle={esHoy ? 'Todavía no abrieron' : 'No abrieron'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.locales.map((l) => (
              <div key={l.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--crm-color-border)', background: 'var(--crm-color-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: l.turnos.length ? 6 : 0 }}>
                  <strong style={{ fontSize: 15 }}>{l.nombre}</strong>
                  {!l.turnos.length && <span style={{ marginLeft: 'auto' }}><Pastilla color="var(--crm-color-text-secondary)">{esHoy ? 'Todavía no abrió caja' : 'No abrió caja'}</Pastilla></span>}
                </div>
                {l.turnos.map((t) => <Turno key={t.id} t={t} onControlar={onControlar} />)}
              </div>
            ))}
          </div>

          <div className={s.hint} style={{ margin: 0 }}>
            <strong>Sin rendir</strong>: cerró y mandó el sobre, pero todavía no lo controlaste. <strong>Rendida</strong>: sobre controlado.
            {' '}<strong>Cerró sin sobre</strong>: no mandó efectivo (todo quedó en la caja). Una caja abierta de otro día aparece en rojo hasta que la cierren.
            {p.cashflowDesde && ` Los sobres se rinden en el Cash Flow desde el ${fechaIso(p.cashflowDesde)}.`}
          </div>
        </>
      )}
    </div>
  );
}
