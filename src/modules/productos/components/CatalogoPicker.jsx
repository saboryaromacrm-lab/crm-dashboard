/**
 * SELECTORES DE CATÁLOGO
 * ============================================================================
 * `CatalogoPicker` es un desplegable ESCRIBIBLE: filtra mientras se tipea y, si
 * lo escrito no existe, ofrece crearlo ahí mismo. Es la diferencia entre cargar
 * un producto en diez segundos o en un minuto — el alta no se interrumpe para
 * ir a administrar el catálogo y volver.
 *
 * Dos detalles que sostienen que se sienta fluido:
 *   · lo recién creado queda SELECCIONADO, sin volver a buscarlo;
 *   · el link "Administrar" abre un modal ENCIMA, nunca navega: el formulario
 *     de producto tiene datos sin grabar y perderlos sería imperdonable.
 *
 * `EtiquetasPicker` es el mismo mecanismo pero de selección múltiple.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { s } from './ui.jsx';

/** Texto comparable: sin acentos ni caja. Espejo de `norm()` del backend. */
export function norm(v) {
  return (v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
}

/**
 * @param {object[]} opciones  [{ id, nombre, activa }]
 * @param {number|null} value  id elegido
 * @param {(id:number|null)=>void} onChange
 * @param {(nombre:string)=>Promise<object|null>} onCrear  devuelve la fila creada
 * @param {()=>void} onAdministrar  abre el ABM completo
 */
export function CatalogoPicker({
  label, value, opciones, onChange, onCrear, onAdministrar,
  placeholder = 'Buscar o crear…', requerido = false, disabled = false, ayuda,
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [creando, setCreando] = useState(false);
  const cajaRef = useRef(null);

  const elegido = useMemo(() => opciones.find((o) => o.id === value) || null, [opciones, value]);

  // Un catálogo dado de baja sigue mostrándose si es el que el producto tiene
  // cargado: ocultarlo haría ver el campo vacío y "perder" el dato al guardar.
  const visibles = useMemo(() => {
    const q = norm(texto);
    return opciones
      .filter((o) => o.activa !== false || o.id === value)
      .filter((o) => !q || norm(o.nombre).includes(q))
      .slice(0, 50);
  }, [opciones, texto, value]);

  // ¿Lo tipeado es un nombre nuevo? Solo entonces se ofrece crearlo.
  const exacto = useMemo(
    () => opciones.some((o) => norm(o.nombre) === norm(texto)),
    [opciones, texto],
  );
  const puedeCrear = !!onCrear && texto.trim().length > 0 && !exacto;

  // Clic afuera = cerrar sin tocar el valor.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) cerrar(); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const cerrar = () => { setAbierto(false); setTexto(''); };

  const elegir = (id) => { onChange(id); cerrar(); };

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    const fila = await onCrear(texto.trim());
    setCreando(false);
    // Lo nuevo queda elegido: es lo que se estaba por hacer.
    if (fila && fila.id) elegir(fila.id);
  };

  const teclas = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibles.length === 1) elegir(visibles[0].id);
      else if (puedeCrear) crear();
    }
  };

  return (
    <div className={s.field} ref={cajaRef} style={{ position: 'relative' }}>
      <label>
        {label} {requerido && <span className={s.req}>*</span>}
        {onAdministrar && (
          <button type="button" className={s.linkBtn} onClick={onAdministrar} tabIndex={-1}>
            Administrar
          </button>
        )}
      </label>

      {abierto ? (
        <input
          autoFocus
          value={texto}
          disabled={disabled}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={teclas}
          placeholder={placeholder}
        />
      ) : (
        <button
          type="button"
          className={cx(s.pickerBtn, !elegido && s.pickerVacio)}
          disabled={disabled}
          onClick={() => setAbierto(true)}
        >
          <span>{elegido ? elegido.nombre : '— Sin asignar —'}</span>
          <span className={s.pickerCaret}>▾</span>
        </button>
      )}

      {abierto && (
        <div className={s.pickerMenu}>
          {value != null && (
            <button type="button" className={cx(s.pickerItem, s.muted)} onClick={() => elegir(null)}>
              — Sin asignar —
            </button>
          )}
          {visibles.map((o) => (
            <button
              key={o.id}
              type="button"
              className={cx(s.pickerItem, o.id === value && s.pickerActivo)}
              onClick={() => elegir(o.id)}
            >
              {o.nombre}
              {o.activa === false && <span className={s.muted}> · inactiva</span>}
            </button>
          ))}
          {puedeCrear && (
            <button type="button" className={cx(s.pickerItem, s.pickerCrear)} onClick={crear} disabled={creando}>
              + Crear «{texto.trim()}»
            </button>
          )}
          {!visibles.length && !puedeCrear && (
            <div className={cx(s.pickerItem, s.muted)}>Sin coincidencias.</div>
          )}
        </div>
      )}

      {ayuda && <div className={s.hint} style={{ margin: '6px 0 0' }}>{ayuda}</div>}
    </div>
  );
}

/** Selección múltiple. Las elegidas se muestran como chips que se quitan al clic. */
export function EtiquetasPicker({ label = 'Etiquetas', value = [], opciones, onChange, onCrear, onAdministrar }) {
  const [texto, setTexto] = useState('');
  const [creando, setCreando] = useState(false);

  const elegidas = useMemo(
    () => value.map((id) => opciones.find((o) => o.id === id)).filter(Boolean),
    [value, opciones],
  );

  const sugeridas = useMemo(() => {
    const q = norm(texto);
    if (!q) return [];
    return opciones
      .filter((o) => o.activa !== false && !value.includes(o.id) && norm(o.nombre).includes(q))
      .slice(0, 8);
  }, [opciones, texto, value]);

  const exacto = useMemo(() => opciones.some((o) => norm(o.nombre) === norm(texto)), [opciones, texto]);
  const puedeCrear = !!onCrear && texto.trim().length > 0 && !exacto;

  const agregar = (id) => { onChange([...value, id]); setTexto(''); };
  const quitar = (id) => onChange(value.filter((x) => x !== id));

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    const fila = await onCrear(texto.trim());
    setCreando(false);
    if (fila && fila.id) agregar(fila.id);
  };

  return (
    <div className={s.field}>
      <label>
        {label}
        {onAdministrar && (
          <button type="button" className={s.linkBtn} onClick={onAdministrar} tabIndex={-1}>
            Administrar
          </button>
        )}
      </label>

      {elegidas.length > 0 && (
        <div className={s.chipRow}>
          {elegidas.map((e) => (
            <button
              key={e.id}
              type="button"
              className={s.chip}
              style={e.color ? { background: `color-mix(in srgb, ${e.color} 18%, transparent)`, color: e.color } : undefined}
              onClick={() => quitar(e.id)}
              title="Quitar"
            >
              {e.nombre} <span className={s.chipX}>×</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (sugeridas.length === 1) agregar(sugeridas[0].id);
            else if (puedeCrear) crear();
          }}
          placeholder="Ej: SIN TACC"
        />
        {(sugeridas.length > 0 || puedeCrear) && (
          <div className={s.pickerMenu}>
            {sugeridas.map((o) => (
              <button key={o.id} type="button" className={s.pickerItem} onClick={() => agregar(o.id)}>
                {o.nombre}
              </button>
            ))}
            {puedeCrear && (
              <button type="button" className={cx(s.pickerItem, s.pickerCrear)} onClick={crear} disabled={creando}>
                + Crear «{texto.trim()}»
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
