/**
 * MÉTRICAS · LOS GRÁFICOS (29/9/2026)
 * ============================================================================
 * SVG a mano, sin librería: son dos formas (columnas y barras horizontales) y
 * una librería de gráficos pesa más que todo el módulo. Reglas de la casa:
 *
 *   · UNA serie por gráfico, en el verde del ERP. Nunca dos escalas en un
 *     mismo gráfico: si hay dos medidas, son dos gráficos.
 *   · Barras finas (hasta 24 px), punta redondeada, base recta, 2 px de aire
 *     entre barras que se tocan. Grilla y ejes discretos.
 *   · El número se lee en el eje y al pasar el mouse (o con el dedo), no
 *     escrito arriba de cada barra. Los textos van en los colores de texto,
 *     nunca en el color de la barra.
 *   · Con valores negativos (una devolución que superó la venta) la barra baja
 *     desde el cero, en el color de peligro y con el signo en el texto.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { compacto } from './formato.js';

/** «Números redondos» para el eje: 0, 25.000, 50.000… */
function escala(max) {
  if (!(max > 0)) return { tope: 1, pasos: [0, 1] };
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / pot;
  const paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
  const tope = Math.ceil(max / paso) * paso;
  const pasos = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) pasos.push(v);
  return { tope, pasos };
}

const TINTA = 'var(--crm-color-text-secondary)';
const GRILLA = 'var(--crm-color-border)';
const COLOR = 'var(--crm-color-primary)';
const NEGATIVO = 'var(--crm-color-danger)';

/**
 * Se dibuja al ANCHO REAL del contenedor (no se estira un dibujo fijo): así
 * la letra de los ejes mide lo mismo en el gráfico ancho y en los chicos.
 */
function useAncho() {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(720);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setAncho(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [caja, ancho];
}

/** Camino de una barra con la punta redondeada y la base recta, de y0 (base) a y1 (punta). */
function barra(x, ancho, y0, y1, redondear = true) {
  const h = Math.abs(y1 - y0);
  const r = redondear ? Math.min(4, ancho / 2, h) : 0;
  return y1 <= y0
    ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + ancho - r} Q${x + ancho},${y1} ${x + ancho},${y1 + r} V${y0} Z`
    : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + ancho - r} Q${x + ancho},${y1} ${x + ancho},${y1 - r} V${y0} Z`;
}

const cajaTooltip = {
  position: 'absolute', top: 4, background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)', borderRadius: 8,
  padding: '6px 10px', fontSize: 12, pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,.12)', whiteSpace: 'nowrap', zIndex: 2,
};

/** La leyenda: un cuadradito del color y el nombre, en color de texto. */
export function Leyenda({ series }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--crm-color-text-secondary)' }}>
      {series.map((x) => (
        <span key={x.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: x.color }} />{x.nombre}
        </span>
      ))}
    </div>
  );
}

/**
 * Columnas de DOS o más series, con una sola escala:
 *   · modo «apilado»  — las partes de un total (granel + enteros = lo vendido).
 *                       2 px de aire entre las partes; la punta redondeada solo arriba.
 *   · modo «agrupado» — una al lado de la otra (el período A contra el B).
 * `datos`: [{ etiqueta, titulo?, valores: [n, n…], detalle? }]; `series`: [{ nombre, color }].
 * Un valor negativo (devoluciones que superan la venta) se dibuja en cero y se
 * lee con su signo en el tooltip: apilar negativos confunde más de lo que muestra.
 */
export function ColumnasMulti({ datos, series, modo = 'agrupado', formato = (v) => v, eje = compacto, alto = 240, titulo, etiquetaCada, pie }) {
  const [caja, ANCHO] = useAncho();
  const [hover, setHover] = useState(null);
  const IZQ = 56; const DER = 8; const ARR = 12; const ABA = 26;
  const pos = (v) => Math.max(0, Number(v) || 0);
  const max = Math.max(1, ...datos.map((d) => (modo === 'apilado' ? d.valores.reduce((a, v) => a + pos(v), 0) : Math.max(0, ...d.valores.map(pos)))));
  const { tope, pasos } = useMemo(() => escala(max), [max]);
  const altoUtil = alto - ARR - ABA;
  const y = (v) => ARR + altoUtil * ((tope - v) / tope);
  const n = Math.max(datos.length, 1);
  const banda = (ANCHO - IZQ - DER) / n;
  const k = series.length;
  const grosor = modo === 'apilado' ? Math.max(2, Math.min(24, banda - 2)) : Math.max(2, Math.min(14, (banda - 4) / k - 1));
  const cada = etiquetaCada ?? Math.max(1, Math.ceil(n / Math.max(4, Math.floor((ANCHO - IZQ) / 56))));
  const d = hover != null ? datos[hover] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Leyenda series={series} />
      <div ref={caja} style={{ position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <svg width={ANCHO} height={alto} viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={titulo} style={{ display: 'block', maxWidth: '100%' }}>
          {pasos.map((v) => (
            <g key={v}>
              <line x1={IZQ} x2={ANCHO - DER} y1={y(v)} y2={y(v)} stroke={GRILLA} strokeWidth="1" />
              <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={TINTA} style={{ fontVariantNumeric: 'tabular-nums' }}>{eje(v)}</text>
            </g>
          ))}
          {datos.map((dt, i) => {
            const cx = IZQ + banda * i + banda / 2;
            const opacidad = hover == null || hover === i ? 1 : 0.45;
            let partes;
            if (modo === 'apilado') {
              // De abajo hacia arriba; la última parte con valor lleva la punta redondeada.
              const ultima = dt.valores.reduce((u, v, j) => (pos(v) > 0 ? j : u), -1);
              let base = 0;
              partes = dt.valores.map((v, j) => {
                const h = pos(v);
                if (!h) return null;
                const y0 = y(base) - (base > 0 ? 1 : 0); // 2 px de aire entre partes (1 de cada lado)
                const y1 = y(base + h) + (j !== ultima ? 1 : 0);
                base += h;
                if (y0 - y1 < 0.5) return null;
                return <path key={j} d={barra(cx - grosor / 2, grosor, y0, y1, j === ultima)} fill={series[j].color} opacity={opacidad} />;
              });
            } else {
              const total = k * grosor + (k - 1) * 2;
              partes = dt.valores.map((v, j) => {
                const h = pos(v);
                if (!h || y(0) - y(h) < 0.5) return null;
                return <path key={j} d={barra(cx - total / 2 + j * (grosor + 2), grosor, y(0), y(h))} fill={series[j].color} opacity={opacidad} />;
              });
            }
            return (
              <g key={i}>
                {partes}
                {i % cada === 0 && <text x={cx} y={alto - 8} textAnchor="middle" fontSize="11" fill={TINTA}>{dt.etiqueta}</text>}
                <rect
                  x={IZQ + banda * i} y={ARR} width={banda} height={altoUtil} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
                />
              </g>
            );
          })}
          <line x1={IZQ} x2={ANCHO - DER} y1={y(0)} y2={y(0)} stroke="var(--crm-color-text-muted)" strokeWidth="1" />
        </svg>
        {d && (
          <div role="status" style={{ ...cajaTooltip, left: `${Math.min(70, Math.max(2, ((IZQ + banda * hover) / ANCHO) * 100))}%` }}>
            <div style={{ color: 'var(--crm-color-text-secondary)' }}>{d.titulo ?? d.etiqueta}</div>
            {series.map((se, j) => (
              <div key={se.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: se.color }} />
                <span style={{ color: 'var(--crm-color-text-secondary)' }}>{d.nombres?.[j] ?? se.nombre}</span>
                <strong style={{ marginLeft: 'auto', paddingLeft: 10, color: 'var(--crm-color-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {d.valores[j] == null ? '—' : formato(d.valores[j])}
                </strong>
              </div>
            ))}
            {d.detalle && <div style={{ color: 'var(--crm-color-text-secondary)', marginTop: 2 }}>{d.detalle}</div>}
          </div>
        )}
      </div>
      {pie}
    </div>
  );
}

/**
 * Una barra horizontal partida en dos (o más) al 100 %: qué parte es cada una.
 * El % va escrito al lado, así no depende del color.
 */
export function Reparto({ partes, alto = 12 }) {
  const total = partes.reduce((a, p) => a + Math.max(0, Number(p.valor) || 0), 0);
  return (
    <span style={{ display: 'flex', height: alto, borderRadius: 4, overflow: 'hidden', gap: 2, background: 'var(--crm-color-surface-2, rgba(0,0,0,.05))', minWidth: 60 }}>
      {total > 0 && partes.map((p) => {
        const v = Math.max(0, Number(p.valor) || 0);
        return v > 0 ? <span key={p.nombre} title={p.nombre} style={{ width: `${(v / total) * 100}%`, background: p.color }} /> : null;
      })}
    </span>
  );
}

/**
 * Columnas de UNA serie. `datos`: [{ etiqueta, valor, detalle? }]. `formato`
 * convierte el valor en texto para el tooltip; el eje usa `compacto`.
 */
export function Columnas({ datos, formato = (v) => v, eje = compacto, alto = 220, titulo, etiquetaCada }) {
  const [caja, ANCHO] = useAncho();
  const [hover, setHover] = useState(null);
  const IZQ = 56; const DER = 8; const ARR = 12; const ABA = 26;
  const valores = datos.map((d) => Number(d.valor) || 0);
  const maxPos = Math.max(0, ...valores);
  const maxNeg = Math.max(0, ...valores.map((v) => -v));
  const { tope, pasos } = useMemo(() => escala(Math.max(maxPos, maxNeg * 0.25, 1)), [maxPos, maxNeg]);
  const baja = maxNeg > 0 ? Math.min(maxNeg, tope) : 0;
  const altoUtil = alto - ARR - ABA;
  const y = (v) => ARR + altoUtil * ((tope - v) / (tope + baja));
  const n = Math.max(datos.length, 1);
  const banda = (ANCHO - IZQ - DER) / n;
  const grosor = Math.max(2, Math.min(24, banda - 2));
  // Cada cuántas etiquetas se escribe una, para que no se pisen.
  const cada = etiquetaCada ?? Math.max(1, Math.ceil(n / Math.max(4, Math.floor((ANCHO - IZQ) / 56))));

  return (
    <div ref={caja} style={{ position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <svg width={ANCHO} height={alto} viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={titulo} style={{ display: 'block', maxWidth: '100%' }}>
        {pasos.map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={ANCHO - DER} y1={y(v)} y2={y(v)} stroke={GRILLA} strokeWidth="1" />
            <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={TINTA} style={{ fontVariantNumeric: 'tabular-nums' }}>{eje(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const v = Number(d.valor) || 0;
          const cx = IZQ + banda * i + banda / 2;
          const x = cx - grosor / 2;
          const y0 = y(0);
          const y1 = y(Math.max(-baja, Math.min(tope, v)));
          const h = Math.abs(y1 - y0);
          const r = Math.min(4, grosor / 2, h);
          // Punta redondeada, base recta (la barra crece desde el cero).
          const camino = v >= 0
            ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + grosor - r} Q${x + grosor},${y1} ${x + grosor},${y1 + r} V${y0} Z`
            : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + grosor - r} Q${x + grosor},${y1} ${x + grosor},${y1 - r} V${y0} Z`;
          return (
            <g key={i}>
              {h > 0.5 && <path d={camino} fill={v >= 0 ? COLOR : NEGATIVO} opacity={hover == null || hover === i ? 1 : 0.45} />}
              {i % cada === 0 && (
                <text x={cx} y={alto - 8} textAnchor="middle" fontSize="11" fill={TINTA}>{d.etiqueta}</text>
              )}
              {/* Zona de hover más ancha que la barra: toda la banda, de arriba abajo. */}
              <rect
                x={IZQ + banda * i} y={ARR} width={banda} height={altoUtil} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
        <line x1={IZQ} x2={ANCHO - DER} y1={y(0)} y2={y(0)} stroke="var(--crm-color-text-muted)" strokeWidth="1" />
      </svg>
      {hover != null && datos[hover] && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 4, left: `${Math.min(78, Math.max(2, ((IZQ + banda * hover) / ANCHO) * 100))}%`,
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)', borderRadius: 8,
            padding: '6px 10px', fontSize: 12, pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,.12)', whiteSpace: 'nowrap', zIndex: 2,
          }}
        >
          <div style={{ color: 'var(--crm-color-text-secondary)' }}>{datos[hover].titulo ?? datos[hover].etiqueta}</div>
          <strong style={{ color: 'var(--crm-color-text)', fontVariantNumeric: 'tabular-nums' }}>{formato(datos[hover].valor)}</strong>
          {datos[hover].detalle && <div style={{ color: 'var(--crm-color-text-secondary)' }}>{datos[hover].detalle}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Barras horizontales de UNA serie (sucursales, medios de pago): el nombre a la
 * izquierda, el valor escrito al final de la barra. HTML y no SVG: los nombres
 * largos se cortan con «…» sin romper el dibujo.
 */
export function Barras({ datos, formato = (v) => v, sufijo }) {
  const max = Math.max(1, ...datos.map((d) => Math.abs(Number(d.valor) || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {datos.map((d) => {
        const v = Number(d.valor) || 0;
        const ancho = Math.max(0.5, (Math.abs(v) / max) * 100);
        return (
          <div key={d.clave ?? d.etiqueta} title={d.detalle || undefined} style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 30%) minmax(40px, 1fr) auto', gap: 10, alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--crm-color-text)' }}>{d.etiqueta}</span>
            <span style={{ height: 12, background: 'var(--crm-color-surface-2, rgba(0,0,0,.05))', borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${ancho}%`, background: v >= 0 ? COLOR : NEGATIVO, borderRadius: '0 4px 4px 0' }} />
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--crm-color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {formato(v)}{sufijo ? <span style={{ color: 'var(--crm-color-text-secondary)' }}> {sufijo(d)}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
