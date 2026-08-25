/**
 * DISEÑADOR DE LA ETIQUETA DEL FRACCIONADO (25/8) — "hacelo igual": el mismo
 * editor de arrastrar que el cartel de góndola, para la etiqueta del paquete.
 * ============================================================================
 * El lienzo es la etiqueta a escala (px = mm × ESCALA); las posiciones se
 * guardan EN MILÍMETROS y la impresión usa esos mismos números. La plantilla
 * es POR FORMATO y vive en la config de impresión del servidor (clave
 * plantillaFraccionado). Sin plantilla rige el diseño flexible de siempre.
 *
 * Es primo hermano de DisenadorCartel (ventas/components) y NO una abstracción
 * compartida a propósito: los elementos son otros (acá hay código de barras
 * con alto y ancho propios, vencimiento, peso) y un genérico que contemple a
 * los dos se vuelve ilegible para ajustar cualquiera.
 *
 * OJO CON EL CÓDIGO DE BARRAS: el SVG se estira al ancho/alto que se le dé
 * (preserveAspectRatio none). Angostarlo mucho afina las barras — abajo de
 * 0,25 mm por barra la térmica imprime lindo y el lector no lee nunca.
 */
import { useMemo, useRef, useState } from 'react';
import { barcodeSvg } from '@core/services/barcode.js';
import {
  cuerpoEtiquetas, htmlDocumento, medidaEtiqueta,
  plantillaFraccionadoPorDefecto, tamanoTextoCartel,
} from '@core/services/imprimir.js';
import { ModalShell } from './Modal.jsx';
import { Btn, s } from './ui.jsx';

const aMedioMm = (v) => Math.round((Number(v) || 0) * 2) / 2;

const NOMBRES = {
  nombre: 'Nombre', peso: 'Peso', precio: 'Precio',
  barras: 'Código de barras', codigo: 'Número del código', vencimiento: 'Vencimiento',
};

export function DisenadorEtiquetaFraccionado({
  formato, inicial, muestra, empresa, guardando, onGuardar, onRestaurar, onCerrar,
}) {
  const med = medidaEtiqueta(formato) || { anchoMm: 50, altoMm: 30 };
  const [pl, setPl] = useState(() => ({ ...plantillaFraccionadoPorDefecto(formato), ...(inicial || {}) }));
  const [sel, setSel] = useState('nombre');

  const E = Math.max(6, Math.min(12, Math.floor(640 / med.anchoMm)));

  /* Todo hueco de la muestra se rellena con un ejemplo: acá se diseña, no se
   * imprime — hay que ver dónde cae cada cosa aunque el paquete elegido no
   * tenga precio o vencimiento. La regla real (dato vacío no sale) no cambia. */
  const datos = useMemo(() => ({
    nombre: muestra?.nombre || 'Nombre del fraccionado',
    peso: muestra?.peso || '500 g',
    precio: muestra?.precio || '$9.999,00',
    codigo: muestra?.codigo || '2099999000014',
    vencimiento: muestra?.vencimiento || '31/12/2026',
  }), [muestra]);

  const svgBarras = useMemo(() => barcodeSvg(datos.codigo, { alto: 30 }), [datos.codigo]);

  const setElem = (key, patch) => setPl((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  /* ------------------------- ARRASTRAR ------------------------- */
  const drag = useRef(null);
  const agarrar = (key) => (ev) => {
    ev.preventDefault();
    setSel(key);
    drag.current = { key, x0: ev.clientX, y0: ev.clientY, ex: pl[key].x, ey: pl[key].y };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const arrastrar = (ev) => {
    const d = drag.current;
    if (!d) return;
    const nx = aMedioMm(d.ex + (ev.clientX - d.x0) / E);
    const ny = aMedioMm(d.ey + (ev.clientY - d.y0) / E);
    setElem(d.key, {
      x: Math.min(Math.max(0, nx), med.anchoMm - 2),
      y: Math.min(Math.max(0, ny), med.altoMm - 2),
    });
  };
  const soltar = () => { drag.current = null; };

  /* La vista previa DE VERDAD: el mismo código que arma lo que va a la impresora. */
  const previa = useMemo(() => htmlDocumento({
    empresa,
    formato,
    titulo: 'Etiqueta',
    cuerpo: cuerpoEtiquetas({ ...datos, cantidad: 1, plantilla: pl }),
  }), [empresa, formato, datos, pl]);

  const estiloBase = (key, e) => ({
    position: 'absolute',
    left: e.x * E,
    top: e.y * E,
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    outline: sel === key ? '2px dashed var(--crm-color-primary, #166534)' : '1px dashed transparent',
    outlineOffset: 1,
  });
  const props = (key) => ({
    onPointerDown: agarrar(key),
    onPointerMove: arrastrar,
    onPointerUp: soltar,
    title: `${NOMBRES[key]} — arrastralo a donde va`,
  });

  const fsNombre = tamanoTextoCartel(datos.nombre, pl.nombre.size, pl.nombre.w, 0.5) * E;

  const lineaTexto = (key, val, peso) => (
    <div
      key={key}
      {...props(key)}
      style={{ ...estiloBase(key, pl[key]), whiteSpace: 'nowrap', fontWeight: peso, fontSize: pl[key].size * E, lineHeight: 1 }}
    >{val}</div>
  );

  const e = pl[sel];
  const campo = (label, prop, min = 0, max = 300) => (
    <div className={s.field} style={{ marginBottom: 0, width: 86 }}>
      <label>{label}</label>
      <input
        type="number" step="0.5" min={min} max={max} value={e?.[prop] ?? ''}
        onChange={(ev) => setElem(sel, { [prop]: Math.min(max, Math.max(min, Number(ev.target.value) || 0)) })}
      />
    </div>
  );
  /* La letra con A− / A+ a la vista (el dueño, 25/8): el campo numérico solo
   * no se encontraba. Pasos de 0,5 mm — lo que se nota en una térmica. */
  const pasoLetra = (d) => setElem(sel, { size: Math.min(40, Math.max(1, aMedioMm((e?.size ?? 3) + d))) });
  const campoLetra = () => (
    <div className={s.field} style={{ marginBottom: 0 }}>
      <label>Letra (mm)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Btn small onClick={() => pasoLetra(-0.5)} title="Achicar la letra">A−</Btn>
        <input
          type="number" step="0.5" min={1} max={40} value={e?.size ?? ''}
          style={{ width: 64, textAlign: 'center' }}
          onChange={(ev) => setElem(sel, { size: Math.min(40, Math.max(1, Number(ev.target.value) || 0)) })}
        />
        <Btn small onClick={() => pasoLetra(0.5)} title="Agrandar la letra">A+</Btn>
      </div>
    </div>
  );

  return (
    <ModalShell
      title="Diseñar la etiqueta del fraccionado"
      subtitle={`La etiqueta real: ${med.anchoMm} × ${med.altoMm} mm. Agarrá cada elemento y llevalo a su lugar — lo que acomodás acá es lo que imprime.`}
      size="lg"
      onClose={onCerrar}
      footer={[
        { texto: 'Volver al diseño estándar', onClick: onRestaurar, disabled: guardando },
        { texto: 'Cancelar', onClick: onCerrar, disabled: guardando },
        { texto: 'Guardar el diseño', clase: 'btn-primary', onClick: () => onGuardar(pl), disabled: guardando },
      ]}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* -------- El lienzo: la etiqueta a escala -------- */}
        <div>
          <div
            style={{
              position: 'relative',
              width: med.anchoMm * E,
              height: med.altoMm * E,
              background: '#fff',
              color: '#000',
              border: '1px solid #999',
              boxShadow: 'var(--crm-shadow-sm, 0 1px 4px rgba(0,0,0,.2))',
              overflow: 'hidden',
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),'
                + ' linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
              backgroundSize: `${5 * E}px ${5 * E}px`,
            }}
            onPointerMove={arrastrar}
            onPointerUp={soltar}
          >
            <div
              {...props('nombre')}
              style={{
                ...estiloBase('nombre', pl.nombre),
                width: pl.nombre.w * E,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontWeight: 800,
                lineHeight: 1,
                fontSize: fsNombre,
              }}
            >{datos.nombre}</div>
            {lineaTexto('peso', datos.peso, 700)}
            {lineaTexto('precio', datos.precio, 800)}
            <div
              {...props('barras')}
              style={{ ...estiloBase('barras', pl.barras), width: pl.barras.w * E, height: pl.barras.h * E }}
              /* El SVG real del código, estirado como en el papel. */
              dangerouslySetInnerHTML={{ __html: svgBarras || '' }}
            />
            <div
              {...props('codigo')}
              style={{
                ...estiloBase('codigo', pl.codigo),
                width: pl.codigo.w * E,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontFamily: "'Courier New', monospace",
                letterSpacing: '0.08em',
                fontSize: pl.codigo.size * E,
                lineHeight: 1,
              }}
            >{datos.codigo}</div>
            {lineaTexto('vencimiento', `Vto ${datos.vencimiento}`, 700)}
          </div>
          <div className={s.hint} style={{ marginTop: 6, maxWidth: med.anchoMm * E }}>
            Cuadrícula de 5 mm, todo se mueve de a 0,5 mm. Los datos de muestra rellenan lo que al
            paquete le falte; al imprimir salen los reales, y el dato que no está (precio,
            vencimiento) no imprime su línea. Ojo con angostar el código de barras: barras más finas
            de 0,25 mm no las lee el lector.
          </div>
        </div>

        {/* -------- Afinar con números + la vista previa real -------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280, flex: 1 }}>
          <div className={s.card} style={{ margin: 0 }}>
            <div style={{ marginBottom: 8 }}><strong>{NOMBRES[sel]}</strong></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {campo('X (mm)', 'x', 0, med.anchoMm)}
              {campo('Y (mm)', 'y', 0, med.altoMm)}
              {(sel === 'nombre' || sel === 'barras' || sel === 'codigo') && campo('Ancho', 'w', 1, med.anchoMm)}
              {sel === 'barras' && campo('Alto', 'h', 1, med.altoMm)}
              {sel !== 'barras' && campoLetra()}
            </div>
            {sel === 'nombre' && (
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                La letra es el tamaño MÁXIMO: un nombre largo se achica solo hasta entrar en el ancho.
              </div>
            )}
          </div>

          <div className={s.card} style={{ margin: 0 }}>
            <div style={{ marginBottom: 6 }}><strong>Así sale de la impresora</strong></div>
            <iframe
              title="Vista previa de la etiqueta diseñada"
              srcDoc={previa}
              style={{
                width: '100%',
                height: Math.max(160, med.altoMm * 4 + 40),
                border: '1px solid var(--crm-color-border)',
                borderRadius: 'var(--crm-radius-sm)',
                background: '#fff',
              }}
            />
            <div className={s.hint} style={{ margin: 0 }}>
              Generada con el mismo código que imprime: si acá se ve bien, sale bien.
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
