/**
 * ASISTENTE DE ESTRUCTURA DE FACTURAS (28/9/2026, pedido del dueño)
 * ============================================================================
 * Para el proveedor cuya factura la lectura automática no resuelve. Tres pasos,
 * todos en el navegador:
 *   1. Se toca un renglón de ejemplo de la factura.
 *   2. Se marca qué es cada palabra: código, descripción, cantidad, precio…
 *   3. Se ve AL INSTANTE cómo queda leída la factura entera con eso, y si la
 *      suma cierra con el papel. Recién ahí se guarda.
 * Lo que se guarda son las posiciones de las columnas (unos números) en el
 * proveedor: desde ese momento sus facturas se leen solas. Sin tocar el sistema.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { money, num } from '../../domain/format.js';
import { pdfjsDelNavegador } from '../../domain/facturas/lineasPdf.js';
import { lineasDelPdf } from '../../domain/facturas/leerRenglones.js';
import { tokensDeLinea } from '../../domain/facturas/tokens.js';
import { ROLES, crearPlantilla, leerConPlantilla } from '../../domain/facturas/plantilla.js';
import { ModalShell } from '../Modal.jsx';
import { Btn, Table, s } from '../ui.jsx';

const nombreRol = new Map(ROLES.map((r) => [r.id, r.nombre]));

export function AsistenteFacturaModal({ proveedorId, proveedorNombre = '', lecturaId = null, volver = null, onListo }) {
  const { store, closeModal, openModal, toast } = useProductos();
  const [lineas, setLineas] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [ejemplo, setEjemplo] = useState(null);
  const [marcas, setMarcas] = useState(() => new Map());
  const [rol, setRol] = useState('descripcion');
  const [codigoAbajo, setCodigoAbajo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const enVuelo = useRef(false);

  const leer = async (datosPromesa) => {
    setCargando(true);
    setError('');
    try {
      const [pdfjs, datos] = await Promise.all([pdfjsDelNavegador(), datosPromesa]);
      const ls = await lineasDelPdf(pdfjs, datos);
      if (!ls) setError('Ese PDF no tiene texto adentro (es un escaneo): el asistente trabaja con PDFs digitales.');
      setLineas(ls);
      setEjemplo(null);
      setMarcas(new Map());
    } catch (e) {
      setError(e?.message || 'No se pudo leer el PDF.');
    } finally {
      setCargando(false);
    }
  };

  // Desde una factura de la bandeja, el PDF se baja solo.
  useEffect(() => {
    if (lecturaId) leer(store.pdfDeLectura(lecturaId).then((x) => x.datos));
  }, [lecturaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tokens = useMemo(() => (lineas ? lineas.map((l) => tokensDeLinea(l)) : []), [lineas]);
  /* Candidatas a renglón: líneas con al menos dos números. Es lo que se ofrece
     primero; las demás quedan a un clic. */
  const candidatas = useMemo(
    () => tokens.map((t, i) => [i, t]).filter(([, t]) => t.filter((x) => x.num != null).length >= 2).map(([i]) => i),
    [tokens],
  );
  const indices = verTodas ? tokens.map((_, i) => i) : candidatas;

  const elegirEjemplo = (i) => {
    setEjemplo(i);
    setConfirmando(false);
    /* Propuesta inicial, para no arrancar de cero: las palabras antes del primer
       número son la descripción y el último número es el importe. Se corrige tocando. */
    const t = tokens[i];
    const m = new Map();
    const primerNum = t.findIndex((x) => x.num != null);
    t.forEach((x, k) => { if (k < primerNum && x.num == null) m.set(k, 'descripcion'); });
    const nums = t.map((x, k) => [x, k]).filter(([x]) => x.num != null);
    if (nums.length) m.set(nums[nums.length - 1][1], 'importe');
    if (nums.length >= 2) m.set(nums[0][1], 'cantidad');
    if (nums.length >= 3) m.set(nums[nums.length - 2][1], 'precio');
    setMarcas(m);
  };

  const marcar = (k) => {
    setConfirmando(false);
    setMarcas((prev) => {
      const m = new Map(prev);
      if (m.get(k) === rol) m.delete(k); else m.set(k, rol);
      return m;
    });
  };

  /* La prueba en vivo: con cada marca, la factura entera se vuelve a leer (es
     cuenta en memoria, instantánea). */
  const prueba = useMemo(() => {
    if (ejemplo == null || !lineas) return null;
    const { plantilla, faltan } = crearPlantilla(tokens[ejemplo], marcas, { codigoAbajo });
    return { plantilla, faltan, ...leerConPlantilla(lineas, plantilla) };
  }, [ejemplo, lineas, tokens, marcas, codigoAbajo]);

  const guardar = async () => {
    if (!prueba || prueba.faltan.length || !prueba.renglones.length) return;
    // Si no cierra con el papel, se pide confirmar: puede faltar un renglón.
    if (!prueba.control.cierra && !confirmando) { setConfirmando(true); return; }
    if (enVuelo.current) return;
    enVuelo.current = true;
    setGuardando(true);
    try {
      await store.plantillaFacturaProveedor(proveedorId, prueba.plantilla);
      toast(`Estructura guardada: las facturas de ${proveedorNombre || 'este proveedor'} se leen solas desde ahora.`, 'ok');
      onListo?.();
      if (volver) openModal('comprobanteForm', volver); else closeModal();
    } catch (e) {
      toast(e?.data?.message || 'No se pudo guardar la estructura.', 'err');
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  };

  const listo = prueba && !prueba.faltan.length && prueba.renglones.length > 0;
  const footer = [
    { texto: volver ? 'Volver a la factura' : 'Cancelar', clase: 'btn-ghost', onClick: () => (volver ? openModal('comprobanteForm', volver) : closeModal()) },
    {
      texto: guardando ? 'Guardando…' : confirmando ? 'Guardar igual' : 'Guardar la estructura',
      clase: 'btn-primary',
      onClick: listo && !guardando ? guardar : () => {},
    },
  ];

  const siguiente = ejemplo != null ? lineas?.[ejemplo + 1] : null;

  return (
    <ModalShell title="Armar la estructura de la factura" subtitle={proveedorNombre} size="lg" onClose={closeModal} footer={footer}>
      {!lecturaId && (
        <div className={s.field} style={{ marginBottom: 12 }}>
          <label htmlFor="asist-pdf">Una factura PDF de {proveedorNombre || 'este proveedor'}</label>
          <input
            id="asist-pdf" type="file" accept="application/pdf,.pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) leer(f.arrayBuffer()); e.target.value = ''; }}
          />
          <div className={s.hint} style={{ margin: '4px 0 0' }}>Se lee en esta computadora: el archivo no se sube a ningún lado.</div>
        </div>
      )}
      {cargando && <div className={cx(s.callout, s.info)}>Leyendo el PDF…</div>}
      {error && <div className={cx(s.callout, s.warn)}>{error}</div>}

      {lineas && (
        <>
          <div className={s['section-title']} style={{ marginTop: 0 }}>1 · Tocá un renglón de ejemplo (un artículo de la factura)</div>
          <div style={{ maxHeight: 190, overflow: 'auto', border: '1px solid var(--crm-color-border)', borderRadius: 8 }}>
            {indices.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => elegirEjemplo(i)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', border: 0, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: ejemplo === i ? 'var(--crm-color-primary)' : 'transparent',
                  color: ejemplo === i ? 'var(--crm-color-primary-contrast)' : 'inherit',
                }}
              >
                {tokens[i].map((t) => t.s).join(' ')}
              </button>
            ))}
          </div>
          <label className={s.hint} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0 0' }}>
            <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />
            Mostrar todas las líneas (no solo las que tienen números)
          </label>
        </>
      )}

      {ejemplo != null && (
        <>
          <div className={s['section-title']}>2 · Elegí qué es y tocá las palabras</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {ROLES.map((r) => (
              <Btn key={r.id} small variant={rol === r.id ? 'btn-primary' : 'btn-ghost'} onClick={() => setRol(r.id)}>{r.nombre}</Btn>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tokens[ejemplo].map((t, k) => {
              const suyo = marcas.get(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => marcar(k)}
                  title={suyo ? `Es: ${nombreRol.get(suyo)} (tocá para cambiar)` : 'Sin marcar'}
                  style={{
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
                    border: `1px solid ${suyo ? 'var(--crm-color-primary)' : 'var(--crm-color-border)'}`,
                    background: suyo ? 'color-mix(in srgb, var(--crm-color-primary) 14%, transparent)' : 'transparent',
                    color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  }}
                >
                  <span>{t.s}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{suyo ? nombreRol.get(suyo) : '—'}</span>
                </button>
              );
            })}
          </div>
          {siguiente && (
            <label className={s.hint} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0 0' }}>
              <input type="checkbox" checked={codigoAbajo} onChange={(e) => { setCodigoAbajo(e.target.checked); setConfirmando(false); }} />
              El código del artículo está en la línea de abajo: <span className={s.mono}>{tokensDeLinea(siguiente).map((t) => t.s).join(' ')}</span>
            </label>
          )}
        </>
      )}

      {prueba && (
        <>
          <div className={s['section-title']}>3 · Así queda leída la factura</div>
          {prueba.faltan.length > 0 ? (
            <div className={cx(s.callout, s.warn)}>
              Falta marcar: <strong>{prueba.faltan.map((r) => nombreRol.get(r)).join(', ')}</strong>.
            </div>
          ) : (
            <div className={cx(s.callout, prueba.control.cierra ? s.ok : s.warn)}>
              <strong>{num(prueba.renglones.length, 0)} renglones</strong> · suman <strong>{money(prueba.control.suma)}</strong>
              {prueba.control.papel != null && <> · el papel dice <strong>{money(prueba.control.papel)}</strong></>}
              {prueba.control.cierra ? ' · cierra ✓' : ' · no cierra: revisá qué falta marcar'}
            </div>
          )}
          {prueba.renglones.length > 0 && (
            <Table cols={[{ h: 'Código' }, { h: 'Descripción' }, { h: 'Cantidad', num: true }, { h: 'Precio', num: true }, { h: 'Desc.', num: true }, { h: 'Importe', num: true }]}>
              {prueba.renglones.slice(0, 40).map((r, i) => (
                <tr key={i}>
                  <td className={s.mono}>{r.codigo.startsWith('D:') ? <span className={s.muted}>—</span> : r.codigo}</td>
                  <td>{r.descripcion}</td>
                  <td className={s.num}>{num(r.cantidad, r.cantidad % 1 ? 2 : 0)} {r.unidad}</td>
                  <td className={s.num}>{r.precioUnit != null ? money(r.precioUnit) : '—'}</td>
                  <td className={s.num}>{r.dto ? `${num(r.dto, 1)}%` : '—'}</td>
                  <td className={s.num}>{money(r.importe)}</td>
                </tr>
              ))}
            </Table>
          )}
          {confirmando && (
            <div className={cx(s.callout, s.warn)} style={{ marginTop: 8 }}>
              La suma <strong>no cierra</strong> con el papel: puede que falte algún renglón. Si igual querés guardarla,
              tocá «Guardar igual» — al cargar cada factura el control de total te va a avisar si algo no cuadra.
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
