/**
 * VISTA PROFESIONAL · LA LÍNEA (5/11/2026). Para lo que es un NIVEL que se
 * mueve en el tiempo (el margen %, el ticket promedio), donde importa la
 * tendencia más que la altura. Mismas reglas que los gráficos de Métricas:
 * una serie, una escala que arranca en cero, línea de 2 px, puntos de 8 px con
 * un aro del color del fondo, grilla discreta y el número al pasar el mouse
 * (línea vertical + cartel). El período en curso va hueco y con trazo cortado:
 * es parcial y no se compara de igual a igual.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

const TINTA = 'var(--crm-color-text-secondary)';
const GRILLA = 'var(--crm-color-border)';
const COLOR = 'var(--crm-color-primary)';
const FONDO = 'var(--crm-color-surface)';

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

function useAncho() {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(520);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setAncho(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [caja, ancho];
}

/** `datos`: [{ etiqueta, titulo?, valor (null = sin dato), parcial?, detalle? }]. */
export function Linea({ datos, formato = (v) => v, eje = formato, alto = 200, titulo }) {
  const [caja, ANCHO] = useAncho();
  const [hover, setHover] = useState(null);
  const IZQ = 56; const DER = 14; const ARR = 14; const ABA = 26;
  const max = Math.max(0, ...datos.map((d) => Number(d.valor) || 0));
  const { tope, pasos } = useMemo(() => escala(max), [max]);
  const altoUtil = alto - ARR - ABA;
  const n = Math.max(datos.length, 1);
  const banda = (ANCHO - IZQ - DER) / n;
  const x = (i) => IZQ + banda * i + banda / 2;
  const y = (v) => ARR + altoUtil * ((tope - Math.max(0, v)) / tope);
  const cada = Math.max(1, Math.ceil(n / Math.max(4, Math.floor((ANCHO - IZQ) / 56))));
  const pts = datos.map((d, i) => (d.valor == null ? null : { i, px: x(i), py: y(Number(d.valor)), parcial: !!d.parcial }));

  /* Tramos: lleno entre puntos firmes, cortado hacia el parcial; un dato que falta corta la línea. */
  const tramos = [];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]; const b = pts[i];
    if (a && b) tramos.push({ a, b, cortado: a.parcial || b.parcial });
  }
  const d = hover != null ? datos[hover] : null;

  return (
    <div ref={caja} style={{ position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <svg width={ANCHO} height={alto} viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={titulo} style={{ display: 'block', maxWidth: '100%' }}>
        {pasos.map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={ANCHO - DER} y1={y(v)} y2={y(v)} stroke={GRILLA} strokeWidth="1" />
            <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={TINTA} style={{ fontVariantNumeric: 'tabular-nums' }}>{eje(v)}</text>
          </g>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={ARR} y2={ARR + altoUtil} stroke="var(--crm-color-text-muted)" strokeWidth="1" />}
        {tramos.map((t) => (
          <line
            key={t.b.i} x1={t.a.px} y1={t.a.py} x2={t.b.px} y2={t.b.py} stroke={COLOR} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={t.cortado ? '4 4' : undefined}
          />
        ))}
        {pts.map((p) => p && (
          <circle
            key={p.i} cx={p.px} cy={p.py} r={hover === p.i ? 5 : 4}
            fill={p.parcial ? FONDO : COLOR} stroke={p.parcial ? COLOR : FONDO} strokeWidth="2"
          />
        ))}
        {datos.map((dt, i) => (
          <g key={i}>
            {i % cada === 0 && <text x={x(i)} y={alto - 8} textAnchor="middle" fontSize="11" fill={TINTA}>{dt.etiqueta}</text>}
            <rect
              x={IZQ + banda * i} y={ARR} width={banda} height={altoUtil} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
            />
          </g>
        ))}
        <line x1={IZQ} x2={ANCHO - DER} y1={y(0)} y2={y(0)} stroke="var(--crm-color-text-muted)" strokeWidth="1" />
      </svg>
      {d && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 4, left: `${Math.min(70, Math.max(2, ((x(hover) - 40) / ANCHO) * 100))}%`,
            background: 'var(--crm-color-surface)', border: '1px solid var(--crm-color-border)', borderRadius: 8,
            padding: '6px 10px', fontSize: 12, pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,.12)', whiteSpace: 'nowrap', zIndex: 2,
          }}
        >
          <div style={{ color: 'var(--crm-color-text-secondary)' }}>{d.titulo ?? d.etiqueta}</div>
          <strong style={{ color: 'var(--crm-color-text)', fontVariantNumeric: 'tabular-nums' }}>{d.valor == null ? '—' : formato(d.valor)}</strong>
          {d.detalle && <div style={{ color: 'var(--crm-color-text-secondary)' }}>{d.detalle}</div>}
        </div>
      )}
    </div>
  );
}
