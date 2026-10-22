/**
 * VENTAS › ASESOR COMERCIAL (0193, 21/10/2026, pedido del dueño)
 * ============================================================================
 * El especialista en ofertas, combos, fechas comerciales, tienda online, venta
 * en el local y productos por vencer. Es la misma pantalla que Gerencia ›
 * Asesor (`Asesor`), con lo suyo:
 *   · En el informe: las PROPUESTAS, cada una con lo que el sistema calculó
 *     (precio con la promoción, costo y margen, con los precios de hoy) y el
 *     botón «Crear oferta», que la deja DESACTIVADA en Ventas › Ofertas para
 *     revisarla y activarla (la IA nunca activa nada). Y el plan de fechas.
 *   · En la configuración: «Tus fechas», las que el calendario no conoce
 *     (aniversario del local, fiesta del pueblo…).
 * Entran el superadmin y quien tenga `ventas.asesor`; crear la oferta pide
 * además el permiso de Ofertas (lo vuelve a controlar el servidor).
 */
import { useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { errorMsg } from '../services/ventas.api.js';
import { useVentas } from '../context/VentasContext.jsx';
import { Btn, Pill, money, s } from '../components/ui.jsx';
import { cx } from '@shared/utils/classNames.js';
import { Asesor, fechaHora } from '@modules/gerencia/panels/asesor/AsesorPanel.jsx';
import { Aviso, Bloque, Cargando } from '@modules/gerencia/panels/metricas/piezas.jsx';

const API = '/asesor-comercial';
const OBJETIVO = {
  vencimiento: 'Por vencer', fecha_comercial: 'Fecha comercial', combo: 'Combo', subir_ticket: 'Subir el ticket',
  mover_stock: 'Mover stock', tienda_online: 'Tienda online', traer_clientes: 'Traer clientes',
};
const CANAL = { local: 'En el local', online: 'En la tienda online', ambos: 'Local y tienda online' };
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`);
const dia = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—');

/** Lo que diría el cartel (mismas palabras que Ventas › Ofertas). */
function mecanica(p) {
  switch (p.tipo) {
    case 'porcentaje': return `${p.porcentaje} % de descuento`;
    case 'precio_fijo': return `Precio oferta ${money(p.precioFinal)}`;
    case 'nxm': return `${p.lleva}×${p.paga}`;
    case 'segunda_unidad': return `2.ª unidad con ${p.porcentaje} % de descuento`;
    case 'pack': return `${p.lleva} por ${money(p.precioFinal)}`;
    case 'combo': return `Combo por ${money(p.precioFinal)}`;
    case 'ticket': return `${p.porcentaje} % al ticket desde ${money(p.montoMinimo)}`;
    default: return p.tipo;
  }
}
/** El margen que deja con la promoción, según el sistema: el del combo, o el peor de sus productos. */
const MARGEN_JUSTO = 15;
function margenDe(sim) {
  if (sim?.combo) return sim.combo.margenComboPct;
  const xs = (sim?.productos ?? []).map((x) => x.margenPromoPct).filter((x) => x != null);
  return xs.length ? Math.min(...xs) : null;
}
const diasTexto = (m) => (/^[01]{7}$/.test(m ?? '') && m !== '1111111' && m !== '0000000' ? DIAS.filter((_, i) => m[i] === '1').join(', ') : 'Todos los días');

const COMERCIAL = {
  api: API,
  titulo: 'Asesor comercial',
  analizarTitulo: 'Analizar ventas y promociones',
  informeTitulo: 'Cómo vienen las ventas',
  desc: 'Una IA especialista en vender más sin regalar margen: ofertas y combos, fechas comerciales, la tienda online, el local y lo que está por vencer. Propone promociones con números; vos decidís cuáles crear.',
  analizarSub: 'Mira lo que viene (fechas comerciales, feriados y las tuyas), lo que vence, cómo rindieron las ofertas, lo que más se vende y lo que se compra junto, la tienda online y los cupones, y propone promociones concretas. Tarda uno o dos minutos; podés seguir usando el sistema mientras tanto.',
  enfoqueEjemplo: 'el Día de la Madre, o combos para la Distribuidora',
  areas: {
    vencimientos: 'Por vencer', fechas: 'Fechas', ofertas: 'Ofertas', combos: 'Combos', tienda_online: 'Tienda online', local: 'Local',
    precios: 'Precios', stock: 'Stock', cupones: 'Cupones', datos: 'Datos',
  },
  ejemplos: [
    '¿Qué promoción armo para la próxima fecha comercial?',
    '¿Qué hago con lo que está por vencer?',
    'Armame dos combos con lo que más se compra junto',
    '¿Qué se mira mucho en la tienda online y no se compra?',
  ],
  ficha: {
    titulo: 'Lo comercial, contado por vos',
    sub: 'Además de la ficha del negocio (Gerencia › Asesor), lo que este asesor tiene que saber para vender: cómo comunicás (WhatsApp, redes, carteles), qué promociones te funcionaron o no, márgenes que no querés tocar, qué productos no se ofertan, cómo es tu público online.',
    ejemplo: 'Ej.: Las promos las pasamos por el estado de WhatsApp y carteles en la caja. El 3x2 en galletitas funcionó; los cupones casi no se usan. Yerba y azúcar no se ofertan (son gancho de precio). En la tienda compran más los mayoristas.',
  },
  InformeExtra: PropuestasYCalendario,
  ConfigExtra: FechasPropias,
};

export function AsesorComercialPanel() {
  return <Asesor cfg={COMERCIAL} />;
}

/* ==================================================================== *
 * Propuestas y calendario (dentro del informe)
 * ==================================================================== */
function PropuestasYCalendario({ informe, onCambio }) {
  const inf = informe.informe;
  return (
    <>
      {inf.propuestas?.length > 0 && (
        <Bloque
          titulo={`Promociones que propone (${inf.propuestas.length})`}
          sub="Los números de cada una los calcula el sistema con los precios y costos de hoy (precios finales, márgenes sin IVA). «Crear oferta» la deja cargada y DESACTIVADA en Ventas › Ofertas: la revisás y la activás vos."
        >
          {inf.propuestas.map((p, i) => <Propuesta key={i} p={p} i={i} informeId={informe.id} accion={informe.acciones?.[i]} onCambio={onCambio} />)}
        </Bloque>
      )}
      {inf.calendario?.length > 0 && (
        <Bloque titulo="Plan para las próximas fechas" sub="Qué preparar y desde cuándo. Las fechas que se corren (Hot Sale, CyberMonday…) confirmalas antes.">
          <div style={{ display: 'grid', gap: 8 }}>
            {inf.calendario.map((c, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className={s.mono} style={{ minWidth: 92, fontSize: 13 }}>{dia(c.fecha)}</span>
                <strong style={{ minWidth: 140 }}>{c.nombre}</strong>
                <span style={{ flex: '1 1 300px', lineHeight: 1.5 }}>{c.queHacer}</span>
              </div>
            ))}
          </div>
        </Bloque>
      )}
    </>
  );
}

function Propuesta({ p, i, informeId, accion, onCambio }) {
  const { canAny } = usePermissions();
  const { sucursalesTodas, goPanel } = useVentas();
  const [creando, setCreando] = useState(false);
  const [err, setErr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const enVuelo = useRef(false);
  const puedeCrear = canAny(['ventas.ofertas', 'ofertas']);
  const sinProductos = p.tipo !== 'ticket' && !(p.productos ?? []).some((x) => x.productoId > 0);
  const sim = p.simulacion;
  const margen = margenDe(sim);
  const sucs = (p.sucursales ?? []).map((id) => sucursalesTodas.find((x) => x.id === id)?.nombre ?? `#${id}`);

  const crear = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true; setCreando(true); setErr('');
    try { await httpClient.post(`${API}/informes/${informeId}/propuestas/${i}/crear`, {}); onCambio(); } catch (e) { setErr(errorMsg(e)); } finally { enVuelo.current = false; setCreando(false); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(p.comoComunicarla); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles: se copia a mano */ }
  };

  return (
    <div className={cx(s.card, s.cardPad)} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill pill="st-disponible" label={OBJETIVO[p.objetivo] ?? p.objetivo} />
        <strong style={{ flex: '1 1 260px', fontSize: 15 }}>{p.titulo}</strong>
        {margen != null && (
          <Pill
            pill={margen < 0 ? 'st-defectuoso' : margen < MARGEN_JUSTO ? 'st-comprometido' : 'st-disponible'}
            label={margen < 0 ? 'Bajo el costo' : `Deja ${pct(margen)}`}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }} className={s.hint}>
        <span><strong>{mecanica(p)}</strong></span>
        <span>{dia(p.desde)} al {dia(p.hasta)}</span>
        <span>{diasTexto(p.dias)}</span>
        <span>{sucs.length ? sucs.join(', ') : 'Todos los locales'}</span>
        <span>{CANAL[p.canal] ?? p.canal}</span>
      </div>
      <div style={{ lineHeight: 1.5 }}><span className={s['mini-label']}>Por qué</span> {p.porQue}</div>

      <Simulacion sim={sim} />
      {p.avisos?.length > 0 && <Aviso tono="warn">{p.avisos.map((a, k) => <div key={k}>{a}</div>)}</Aviso>}

      <div className={cx(s.callout, s.info)} style={{ margin: 0, display: 'grid', gap: 6 }}>
        <div><strong>Cómo comunicarla:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{p.comoComunicarla}</span></div>
        <div><Btn small onClick={copiar}>{copiado ? 'Copiado' : 'Copiar el texto'}</Btn></div>
      </div>
      <div className={s.hint} style={{ margin: 0 }}><strong>Riesgo:</strong> {p.riesgo}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {accion ? (
          <>
            <span className={s.hint} style={{ margin: 0, flex: 1 }}>
              Creada {accion.ofertaId ? `como oferta #${accion.ofertaId}` : ''} el {fechaHora(accion.fecha)}, DESACTIVADA: revisala y activala en Ofertas.
            </span>
            {puedeCrear && <Btn small onClick={() => goPanel('ofertas')}>Ir a Ofertas</Btn>}
          </>
        ) : !puedeCrear ? (
          <span className={s.hint} style={{ margin: 0 }}>Para crearla hace falta el permiso de Ofertas.</span>
        ) : sinProductos ? (
          <span className={s.hint} style={{ margin: 0 }}>Sin productos identificados: cargala a mano en Ventas › Ofertas.</span>
        ) : (
          <Btn variant="btn-primary" small onClick={crear} disabled={creando}>{creando ? 'Creando…' : 'Crear oferta (desactivada)'}</Btn>
        )}
      </div>
      {err && <Aviso tono="warn">{err}</Aviso>}
    </div>
  );
}

/** Lo que calculó el sistema: por producto, o el combo entero. */
function Simulacion({ sim }) {
  if (sim?.combo) {
    const c = sim.combo;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className={s.table} style={{ fontSize: 13 }}>
            <thead><tr><th>En el combo</th><th className={s.num}>Cant.</th><th className={s.num}>Precio suelto</th><th className={s.num}>Costo</th></tr></thead>
            <tbody>
              {c.productos.map((x, k) => (
                <tr key={k}><td>{x.producto}</td><td className={s.num}>{x.cantidad}</td><td className={s.num}>{money(x.precioLista)}</td><td className={s.num}>{money(x.costo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13 }}>
          <span>Suelto: <strong>{money(c.precioListaTotal)}</strong></span>
          <span>Combo: <strong>{money(c.precioCombo)}</strong> ({pct(c.descuentoPct)} menos)</span>
          <span>Ganancia sin IVA: {money(c.margenAntes)} suelto → <strong style={{ color: c.bajoCosto ? 'var(--crm-color-danger)' : undefined }}>{money(c.margenCombo)}</strong> con el combo ({pct(c.margenComboPct)})</span>
        </div>
      </div>
    );
  }
  if (!sim?.productos?.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={s.table} style={{ fontSize: 13 }}>
        <thead>
          <tr><th>Producto</th><th className={s.num}>Precio hoy</th><th className={s.num}>Con la promo (c/u)</th><th className={s.num}>Desc.</th><th className={s.num}>Costo</th><th className={s.num}>Ganancia c/u sin IVA (hoy → con la promo)</th></tr>
        </thead>
        <tbody>
          {sim.productos.map((x, k) => (
            <tr key={k}>
              <td>{x.producto}</td>
              <td className={s.num}>{money(x.precioLista)}</td>
              <td className={s.num}>{money(x.precioPromoPorUnidad)}</td>
              <td className={s.num}>{pct(x.descuentoPct)}</td>
              <td className={s.num}>{money(x.costo)}</td>
              <td className={s.num} style={{ whiteSpace: 'nowrap' }}>
                {money(x.margenAntesPorUnidad)} → <strong style={{ color: x.bajoCosto ? 'var(--crm-color-danger)' : undefined }}>{money(x.margenPromoPorUnidad)}</strong> ({pct(x.margenPromoPct)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==================================================================== *
 * Tus fechas (en Configuración)
 * ==================================================================== */
const FECHA_VACIA = { fecha: '', nombre: '', nota: '', anual: true };

function FechasPropias() {
  const [version, setVersion] = useState(0);
  const [nueva, setNueva] = useState(FECHA_VACIA);
  const [msg, setMsg] = useState(null);
  const enVuelo = useRef(false);
  const { data: fechas, loading } = useResource(`${API}:fechas:${version}`, () => httpClient.get(`${API}/fechas`));
  const hacer = async (fn, ok) => {
    if (enVuelo.current) return;
    enVuelo.current = true; setMsg(null);
    try { await fn(); setMsg({ tono: 'info', texto: ok }); setVersion((v) => v + 1); } catch (e) { setMsg({ tono: 'warn', texto: errorMsg(e) }); } finally { enVuelo.current = false; }
  };
  const agregar = () => hacer(async () => {
    await httpClient.post(`${API}/fechas`, { ...nueva, nombre: nueva.nombre.trim(), nota: nueva.nota.trim() });
    setNueva(FECHA_VACIA);
  }, 'Fecha agregada.');
  const set = (k) => (e) => setNueva((x) => ({ ...x, [k]: k === 'anual' ? e.target.checked : e.target.value }));

  return (
    <Bloque
      titulo="Tus fechas"
      sub="Las fechas comerciales y los feriados ya los conoce. Sumá las tuyas: el aniversario del local, la fiesta del pueblo, el cobro de un convenio… Las que se repiten cada año, tildalas como anuales."
    >
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      {loading && !fechas ? <Cargando /> : !fechas?.length ? <div className={s.hint} style={{ margin: 0 }}>Ninguna todavía.</div> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {fechas.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className={s.mono} style={{ minWidth: 92, fontSize: 13 }}>{dia(f.fecha)}</span>
              <strong>{f.nombre}</strong>
              <span className={s.hint} style={{ margin: 0, flex: '1 1 200px' }}>{f.anual ? 'Todos los años' : 'Solo esa vez'}{f.nota ? ` · ${f.nota}` : ''}</span>
              <Btn small variant="btn-delete" onClick={() => window.confirm(`¿Borrar «${f.nombre}»?`) && hacer(() => httpClient.delete(`${API}/fechas/${f.id}`), 'Borrada.')}>Borrar</Btn>
            </div>
          ))}
        </div>
      )}
      <div className={s.toolbar} style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input id="asesor-fecha-dia" type="date" value={nueva.fecha} onChange={set('fecha')} aria-label="Fecha" />
        <input id="asesor-fecha-nombre" value={nueva.nombre} maxLength={80} onChange={set('nombre')} placeholder="Nombre (ej.: Aniversario de Fontana)" style={{ flex: '1 1 220px', minWidth: 0 }} />
        <input id="asesor-fecha-nota" value={nueva.nota} maxLength={300} onChange={set('nota')} placeholder="Nota opcional (qué se vende, qué se hace)" style={{ flex: '1 1 220px', minWidth: 0 }} />
        <label htmlFor="asesor-fecha-anual" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input id="asesor-fecha-anual" type="checkbox" checked={nueva.anual} onChange={set('anual')} /> Todos los años
        </label>
        <Btn small disabled={!nueva.fecha || nueva.nombre.trim().length < 3} onClick={agregar}>Agregar</Btn>
      </div>
    </Bloque>
  );
}
