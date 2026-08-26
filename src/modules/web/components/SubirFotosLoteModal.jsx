/**
 * FOTOS DE LA TIENDA EN LOTE (25/8) — decenas de archivos de una sola vez.
 * ============================================================================
 * De a una eran ~5 acciones por producto; acá se arrastran los archivos y el
 * sistema empareja cada uno con su producto POR EL NOMBRE DEL ARCHIVO, en este
 * orden de confianza:
 *
 *   1. CÓDIGO DE BARRAS — un token de dígitos que sea exactamente el código de
 *      algún producto ("7791885005213.jpg", "foto 7791885005213 v2.png").
 *      Infalible, y es como vienen nombrados los catálogos de los proveedores.
 *   2. CÓDIGO PROPIO — mismo criterio, contra el código interno.
 *   3. NOMBRE — normalizado (sin acentos ni signos): igualdad = emparejado;
 *      parecido = DUDOSO con el candidato precargado para confirmar mirando.
 *
 * Lo que no empareja queda SIN DESTINO y se asigna a mano con el selector de
 * la fila — sigue siendo una acción por foto, sin modal por medio.
 *
 * La subida usa EL MISMO MOLDE que el botón de a una (moldear → WebP → POST
 * por producto): acá no se decide nada nuevo, solo se repite en tanda. El
 * endpoint valida igual que siempre — esto es puro frontend.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { cx } from '@shared/utils/classNames.js';
import {
  MAX_ENTRADA_MB, PRESETS_IMAGEN, cargarImagen, moldear, quitarFondo, exportar,
} from '../services/imagenes.js';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** El nombre del archivo, sin extensión ni sufijos de copia ("(1)", "- copia"). */
const baseArchivo = (nombre) => String(nombre)
  .replace(/\.[a-z0-9]+$/i, '')
  .replace(/\((\d+)\)\s*$/, '')
  .replace(/-?\s*copia\s*$/i, '');

/**
 * Empareja UN archivo contra el catálogo. Devuelve `{ prodId, estado }` con
 * estado 'emparejado' (seguro), 'dudoso' (candidato para confirmar) o 'sin'.
 */
function emparejar(nombreArchivo, productos) {
  const base = baseArchivo(nombreArchivo);

  // 1 y 2 — códigos, por token exacto: no hay dos productos con el mismo.
  const tokens = base.split(/[^a-z0-9]+/i).filter(Boolean);
  for (const t of tokens) {
    if (/^\d{6,}$/.test(t)) {
      const porBarras = productos.find((p) => p.codigoBarras === t);
      if (porBarras) return { prodId: porBarras.id, estado: 'emparejado' };
    }
    const tl = t.toLowerCase();
    const porPropio = productos.find((p) => p.codigoPropio && p.codigoPropio.toLowerCase() === tl);
    if (porPropio) return { prodId: porPropio.id, estado: 'emparejado' };
  }

  // 3 — nombre normalizado. Igualdad exacta convence; lo parecido se marca
  // DUDOSO aunque haya un solo candidato: "alfajor chocolate" pega con tres
  // alfajores y elegir por el sistema sería adivinar con la góndola ajena.
  const nb = norm(base);
  if (!nb) return { prodId: null, estado: 'sin' };
  const exacto = productos.find((p) => norm(p.nombre) === nb);
  if (exacto) return { prodId: exacto.id, estado: 'emparejado' };

  const palabras = nb.split(' ').filter((w) => w.length >= 3);
  if (!palabras.length) return { prodId: null, estado: 'sin' };
  const candidatos = productos.filter((p) => {
    const pn = `${norm(p.nombre)} ${norm(p.marca)}`;
    return palabras.every((w) => pn.includes(w));
  });
  if (candidatos.length === 1) return { prodId: candidatos[0].id, estado: 'dudoso' };
  return { prodId: null, estado: 'sin' };
}

const CHIP = {
  emparejado: { texto: 'EMPAREJADO', color: 'var(--crm-color-success)' },
  dudoso: { texto: 'CONFIRMAR', color: 'var(--crm-color-warning, #b45309)' },
  sin: { texto: 'SIN DESTINO', color: 'var(--crm-color-danger)' },
};

export function SubirFotosLoteModal({ productos, onCerrar, onListo, avisar }) {
  // Cada fila: { clave, file, url (para la miniatura), prodId, estado, resultado }
  const [filas, setFilas] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(null); // { hecho, total }
  const [termino, setTermino] = useState(false);
  /* Quitar el fondo EN TANDA es opcional y arranca apagado: acá no hay vista
   * previa por foto, y el flood-fill puede comerse un producto claro que toque
   * el borde. Para fondos lisos (la foto de catálogo) anda muy bien; la que
   * salga mal se corrige después con el "Subir" de esa fila, que tiene el
   * "Restaurar fondo". */
  const [sacarFondo, setSacarFondo] = useState(false);
  const inputRef = useRef(null);

  /* Las URLs de las miniaturas se liberan al cerrar: son blobs del navegador
   * y cada una retiene el archivo entero en memoria. */
  useEffect(() => () => { filas.forEach((f) => URL.revokeObjectURL(f.url)); }, [filas]);

  const ordenados = useMemo(
    () => [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [productos],
  );
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const agregarArchivos = (lista) => {
    const nuevos = [];
    for (const file of lista) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) continue;
      if (file.size > MAX_ENTRADA_MB * 1024 * 1024) continue;
      const { prodId, estado } = emparejar(file.name, productos);
      nuevos.push({
        clave: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
        prodId,
        estado,
        resultado: null,
      });
    }
    if (!nuevos.length) { avisar('err', `Ningún archivo servía: JPG, PNG o WebP de hasta ${MAX_ENTRADA_MB} MB.`); return; }
    setFilas((prev) => [...prev, ...nuevos]);
  };

  const onFiles = (e) => { agregarArchivos(e.target.files ?? []); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); if (!subiendo) agregarArchivos(e.dataTransfer?.files ?? []); };

  const setFila = (clave, patch) => setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...patch } : f)));
  const quitar = (clave) => setFilas((prev) => {
    const f = prev.find((x) => x.clave === clave);
    if (f) URL.revokeObjectURL(f.url);
    return prev.filter((x) => x.clave !== clave);
  });

  /* Dos archivos al mismo producto: el segundo pisaría al primero en silencio.
   * Se marca en la fila; se puede subir igual (reemplazar es válido), pero
   * mirándolo, no por accidente. */
  const repetidos = useMemo(() => {
    const conteo = new Map();
    for (const f of filas) if (f.prodId) conteo.set(f.prodId, (conteo.get(f.prodId) ?? 0) + 1);
    return new Set([...conteo.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [filas]);

  const listas = filas.filter((f) => f.prodId);

  const subirTodo = async () => {
    setSubiendo(true);
    setProgreso({ hecho: 0, total: listas.length });
    let ok = 0;
    for (const f of filas) {
      if (!f.prodId) continue;
      try {
        const img = await cargarImagen(f.file);
        const canvas = moldear(img, PRESETS_IMAGEN.producto);
        if (sacarFondo) quitarFondo(canvas);
        const { dataUrl } = exportar(canvas, PRESETS_IMAGEN.producto, { fondoQuitado: sacarFondo });
        await httpClient.post(`/web/imagenes/producto/${f.prodId}`, { data: dataUrl });
        ok += 1;
        setFila(f.clave, { resultado: 'ok' });
      } catch (e) {
        setFila(f.clave, { resultado: e?.data?.message || 'No se pudo subir.' });
      }
      setProgreso((p) => ({ ...p, hecho: (p?.hecho ?? 0) + 1 }));
    }
    setSubiendo(false);
    setTermino(true);
    avisar(ok ? 'ok' : 'err', ok
      ? `${ok} foto${ok === 1 ? '' : 's'} subida${ok === 1 ? '' : 's'}.`
      : 'No se pudo subir ninguna foto.');
    onListo();
  };

  const resumen = {
    emparejado: filas.filter((f) => f.estado === 'emparejado' && f.prodId).length,
    dudoso: filas.filter((f) => f.estado === 'dudoso' && f.prodId).length,
    sin: filas.filter((f) => !f.prodId).length,
  };

  return (
    <ModalShell
      title="Subir fotos en lote"
      subtitle="Arrastrá los archivos: cada uno se empareja con su producto por el nombre del archivo (código de barras, código propio o nombre)."
      size="lg"
      onClose={subiendo ? undefined : onCerrar}
      footer={[
        { texto: termino ? 'Cerrar' : 'Cancelar', onClick: onCerrar, disabled: subiendo },
        ...(termino ? [] : [{
          texto: subiendo
            ? `Subiendo ${progreso?.hecho ?? 0} de ${progreso?.total ?? 0}…`
            : `Subir ${listas.length} foto${listas.length === 1 ? '' : 's'}`,
          clase: 'btn-primary',
          onClick: subirTodo,
          disabled: subiendo || !listas.length,
        }]),
      ]}
    >
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: '2px dashed var(--crm-color-border)',
          borderRadius: 'var(--crm-radius-md)',
          padding: filas.length ? '10px 14px' : '28px 14px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span className={s.muted}>
          {filas.length
            ? `${filas.length} archivo(s) en la tanda — podés seguir arrastrando acá.`
            : 'Arrastrá las fotos acá (JPG, PNG o WebP)…'}
        </span>
        <Btn small onClick={() => inputRef.current?.click()} disabled={subiendo}>Elegir archivos</Btn>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={onFiles} />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer', margin: '10px 0 0' }}>
        <input
          type="checkbox"
          checked={sacarFondo}
          disabled={subiendo}
          onChange={(e) => setSacarFondo(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          <strong>Quitar el fondo de todas las fotos</strong>
          <span className={s.muted} style={{ display: 'block', fontSize: 12 }}>
            Para fotos de fondo liso y claro (la típica de catálogo). Acá no hay vista previa:
            si alguna sale mal, se corrige con el botón Subir de ese producto, que tiene el
            &ldquo;Restaurar fondo&rdquo;.
          </span>
        </span>
      </label>

      {filas.length > 0 && (
        <>
          <div className={s.hint} style={{ margin: '10px 0 6px' }}>
            <strong style={{ color: CHIP.emparejado.color }}>{resumen.emparejado} emparejada(s)</strong>
            {' · '}
            <strong style={{ color: CHIP.dudoso.color }}>{resumen.dudoso} para confirmar</strong>
            {' · '}
            <strong style={{ color: CHIP.sin.color }}>{resumen.sin} sin destino</strong>
            {' — las sin destino no se suben: asignales producto con el selector, o sacalas.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
            {filas.map((f) => {
              const prod = f.prodId ? porId.get(f.prodId) : null;
              const chip = CHIP[f.prodId ? f.estado : 'sin'];
              return (
                <div
                  key={f.clave}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    border: '1px solid var(--crm-color-border)', borderRadius: 'var(--crm-radius-sm)',
                    opacity: subiendo && !f.prodId ? 0.45 : 1,
                  }}
                >
                  <img
                    src={f.url}
                    alt=""
                    style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff', border: '1px solid var(--crm-color-border)', borderRadius: 6 }}
                  />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className={cx(s.mono)} style={{ fontSize: 12, wordBreak: 'break-all' }}>{f.file.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', color: chip.color }}>
                      {chip.texto}
                    </span>
                    {prod?.imagenUrl && f.resultado == null && (
                      <span className={s.muted} style={{ fontSize: 10.5 }}> · ya tiene foto: la reemplaza</span>
                    )}
                    {f.prodId && repetidos.has(f.prodId) && f.resultado == null && (
                      <span style={{ fontSize: 10.5, color: CHIP.dudoso.color, fontWeight: 700 }}>
                        {' '}· otro archivo va al mismo producto
                      </span>
                    )}
                  </div>
                  {f.resultado === 'ok' && <span style={{ color: CHIP.emparejado.color, fontWeight: 700 }}>✓ subida</span>}
                  {f.resultado && f.resultado !== 'ok' && (
                    <span style={{ color: CHIP.sin.color, fontSize: 12 }}>{f.resultado}</span>
                  )}
                  {f.resultado == null && (
                    <select
                      value={f.prodId ?? ''}
                      disabled={subiendo}
                      style={{ maxWidth: 320 }}
                      onChange={(e) => setFila(f.clave, {
                        prodId: e.target.value ? Number(e.target.value) : null,
                        estado: e.target.value ? 'emparejado' : 'sin',
                      })}
                    >
                      <option value="">— elegir producto —</option>
                      {ordenados.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}{p.marca ? ` · ${p.marca}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {f.resultado == null && !subiendo && (
                    <button type="button" className={s['pres-remove']} onClick={() => quitar(f.clave)}>×</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </ModalShell>
  );
}
