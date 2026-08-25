/**
 * DISEÑADOR DEL CARTEL DE GÓNDOLA (25/8) — el pedido del dueño, textual: un
 * recuadro con las medidas exactas del formato elegido, para mover cada
 * elemento (marca, nombre, precios) al lugar que él quiere.
 * ============================================================================
 * POR QUÉ EXISTE. El diseño proporcional adivinaba el layout a partir del alto
 * de la etiqueta, y contra la plantilla física del rollo nunca terminaba de
 * calzar: los carteles seguían saliendo cortados. En vez de seguir ajustando
 * fórmulas a ciegas, el diseño se hace UNA VEZ, a mano y mirando.
 *
 * CÓMO FUNCIONA. El lienzo es la etiqueta a escala (px = mm × ESCALA): las
 * posiciones se guardan EN MILÍMETROS y la impresión usa esos mismos números
 * (ver `cuerpoCartelGondola` con plantilla), así que acomodar acá es acomodar
 * el papel. La vista previa de al lado se genera con el MISMO código que
 * imprime — es la verdad; el lienzo es para agarrar y arrastrar.
 *
 * La plantilla es POR FORMATO (mover el 64×32 no toca un rollo más grande) y
 * se guarda en la config de impresión del servidor: la comparten todas las
 * máquinas, no queda en un navegador.
 */
import { useMemo, useRef, useState } from 'react';
import {
  cuerpoCartelGondola, htmlDocumento, medidaEtiqueta,
  plantillaCartelPorDefecto, tamanoTextoCartel,
} from '@core/services/imprimir.js';
import { ModalShell, s } from './ui.jsx';

/* A medio milímetro: más fino no se nota en una térmica y el número queda legible. */
const aMedioMm = (v) => Math.round((Number(v) || 0) * 2) / 2;

const NOMBRES = {
  recuadro: 'Recuadro', marca: 'Marca', nombre: 'Nombre',
  minorista: 'Precio minorista', mayorista: 'Precio mayorista',
};

export function DisenadorCartel({
  formato, inicial, muestra, empresa, guardando, onGuardar, onRestaurar, onCerrar,
}) {
  const med = medidaEtiqueta(formato) || { anchoMm: 64, altoMm: 32 };
  const base = useMemo(
    () => inicial || plantillaCartelPorDefecto(formato),
    [inicial, formato],
  );
  /* El draft SIEMPRE tiene los cinco elementos (los que falten se completan
   * del diseño estándar): así se puede reactivar el recuadro sin perder dónde
   * estaba, y un elemento nunca "desaparece" del lienzo por un dato viejo. */
  const [pl, setPl] = useState(() => ({ ...plantillaCartelPorDefecto(formato), ...base }));
  const [conRecuadro, setConRecuadro] = useState(() => !inicial || !!inicial.recuadro);
  const [sel, setSel] = useState('marca');

  /* Escala del lienzo: la más grande que entre cómoda en el modal. */
  const E = Math.max(5, Math.min(10, Math.floor(640 / med.anchoMm)));

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
    /* Se permite hasta el borde: si el dueño quiere el precio pegado abajo, es
     * su etiqueta. Solo se impide salirse del papel por completo. */
    setElem(d.key, {
      x: Math.min(Math.max(0, nx), med.anchoMm - 2),
      y: Math.min(Math.max(0, ny), med.altoMm - 2),
    });
  };
  const soltar = () => { drag.current = null; };

  const plParaUsar = useMemo(() => {
    const usar = { ...pl };
    if (!conRecuadro) delete usar.recuadro;
    return usar;
  }, [pl, conRecuadro]);

  /* ACÁ SE DISEÑA, no se imprime: si al producto de muestra le falta un dato
   * (típico: sin precio cargado), igual hay que ver DÓNDE va a caer — así que
   * todo hueco se rellena con un ejemplo, en el lienzo Y en la vista previa.
   * En la impresión real la regla sigue intacta: línea sin dato no sale. Sin
   * esto las dos vistas se contradecían (el lienzo con precios, la vista
   * previa vacía) y parecía un error de la pantalla. */
  const datos = useMemo(() => ({
    marca: muestra.marca || 'MARCA',
    nombre: muestra.nombre || 'Nombre del producto',
    precio: muestra.precio || '$9.999,00',
    precioMayorista: muestra.precioMayorista || '$8.999,00',
  }), [muestra]);

  /* La vista previa DE VERDAD: el mismo código que arma lo que va a la impresora. */
  const previa = useMemo(() => htmlDocumento({
    empresa,
    formato,
    titulo: 'Cartel',
    cuerpo: cuerpoCartelGondola({ ...datos, cantidad: 1, plantilla: plParaUsar }),
  }), [empresa, formato, datos, plParaUsar]);

  /* ---------------- Los elementos sobre el lienzo ---------------- */
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
  const textoProps = (key) => ({
    onPointerDown: agarrar(key),
    onPointerMove: arrastrar,
    onPointerUp: soltar,
    title: `${NOMBRES[key]} — arrastralo a donde va`,
  });

  const fsMarca = tamanoTextoCartel(datos.marca, pl.marca.size, pl.marca.w, 0.68) * E;
  const fsNombre = tamanoTextoCartel(datos.nombre, pl.nombre.size, pl.nombre.w, 0.55) * E;

  const filaPrecio = (key, rot, val) => (
    <div
      key={key}
      {...textoProps(key)}
      style={{ ...estiloBase(key, pl[key]), whiteSpace: 'nowrap', fontSize: pl[key].size * E, lineHeight: 1 }}
    >
      <span style={{ fontWeight: 800, letterSpacing: '0.02em', marginRight: 1.5 * E }}>{rot}:</span>
      <span style={{ fontWeight: 900, fontSize: '1.2em' }}>{val}</span>
    </div>
  );

  /* ---------------- El panel de la derecha (números finos) ---------------- */
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

  return (
    <ModalShell
      title="Diseñar el cartel"
      subtitle={`La etiqueta real: ${med.anchoMm} × ${med.altoMm} mm. Agarrá cada elemento y llevalo a su lugar — lo que acomodás acá es lo que imprime.`}
      size="lg"
      onClose={onCerrar}
      footer={[
        { texto: 'Volver al diseño estándar', onClick: onRestaurar, disabled: guardando },
        { texto: 'Cancelar', onClick: onCerrar, disabled: guardando },
        { texto: 'Guardar el diseño', clase: 'btn-primary', onClick: () => onGuardar(plParaUsar), disabled: guardando },
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
              textTransform: 'uppercase',
              overflow: 'hidden',
              /* La cuadrícula de 5 mm: referencia, no imán. */
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),'
                + ' linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
              backgroundSize: `${5 * E}px ${5 * E}px`,
            }}
            onPointerMove={arrastrar}
            onPointerUp={soltar}
          >
            {conRecuadro && (
              <div
                {...textoProps('recuadro')}
                style={{
                  ...estiloBase('recuadro', pl.recuadro),
                  width: pl.recuadro.w * E,
                  height: pl.recuadro.h * E,
                  border: `${Math.max(1, pl.recuadro.grosor * E)}px solid #000`,
                  borderRadius: 0.5 * E,
                }}
              />
            )}
            <div
              {...textoProps('marca')}
              style={{
                ...estiloBase('marca', pl.marca),
                width: pl.marca.w * E,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontWeight: 900,
                letterSpacing: '0.04em',
                lineHeight: 1,
                fontSize: fsMarca,
              }}
            >{datos.marca}</div>
            <div
              {...textoProps('nombre')}
              style={{
                ...estiloBase('nombre', pl.nombre),
                width: pl.nombre.w * E,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontWeight: 800,
                lineHeight: 1,
                transform: 'scaleX(0.92)',
                transformOrigin: 'center',
                fontSize: fsNombre,
              }}
            >{datos.nombre}</div>
            {filaPrecio('minorista', 'Minorista', datos.precio)}
            {filaPrecio('mayorista', 'Mayorista', datos.precioMayorista)}
          </div>
          <div className={s.hint} style={{ marginTop: 6, maxWidth: med.anchoMm * E }}>
            La cuadrícula es de 5 mm y todo se mueve de a 0,5 mm. Los precios de muestra son de
            ejemplo cuando el renglón no los tiene; al imprimir salen los del catálogo, y la línea
            de mayorista solo si el producto tiene ese precio.
          </div>
        </div>

        {/* -------- Afinar con números + la vista previa real -------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280, flex: 1 }}>
          <div className={s.card} style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <strong>{NOMBRES[sel]}</strong>
              <span style={{ flex: 1 }} />
              <label className={s.hint} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={conRecuadro}
                  onChange={(ev) => { setConRecuadro(ev.target.checked); if (ev.target.checked) setSel('recuadro'); }}
                />
                Con recuadro
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {campo('X (mm)', 'x', 0, med.anchoMm)}
              {campo('Y (mm)', 'y', 0, med.altoMm)}
              {(sel === 'recuadro' || sel === 'marca' || sel === 'nombre') && campo('Ancho', 'w', 1, med.anchoMm)}
              {sel === 'recuadro' && campo('Alto', 'h', 1, med.altoMm)}
              {sel === 'recuadro' && campo('Borde', 'grosor', 0.2, 3)}
              {sel !== 'recuadro' && campo('Letra (mm)', 'size', 1, 40)}
            </div>
            {(sel === 'marca' || sel === 'nombre') && (
              <div className={s.hint} style={{ margin: '6px 0 0' }}>
                La letra es el tamaño MÁXIMO: un texto largo se achica solo hasta entrar en el ancho.
              </div>
            )}
          </div>

          <div className={s.card} style={{ margin: 0 }}>
            <div style={{ marginBottom: 6 }}><strong>Así sale de la impresora</strong></div>
            <iframe
              title="Vista previa del cartel diseñado"
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
