/**
 * BOTÓN DE SUBIDA ESTÁNDAR de imágenes del sitio.
 * ============================================================================
 * Elegir archivo → el motor lo pasa por el MOLDE del preset → modal con la
 * vista previa del RESULTADO FINAL (lo que de verdad se va a ver) → opcional
 * "Quitar fondo" con tolerancia ajustable → Usar imagen.
 *
 * Este es el único camino de entrada de imágenes: un componente futuro que
 * lleve imagen declara su preset acá y hereda molde, compresión, quitado de
 * fondo y previsualización. Nada de <input type=file> sueltos por ahí.
 */
import { useRef, useState } from 'react';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import {
  MAX_ENTRADA_MB, PRESETS_IMAGEN, cargarImagen, moldear, quitarFondo, exportar,
} from '../services/imagenes.js';

/** Fondo cuadriculado: hace visible la transparencia en la vista previa. */
const CUADRICULA = {
  background: 'repeating-conic-gradient(#e8ebe9 0% 25%, #ffffff 0% 50%) 0 / 18px 18px',
  border: '1px solid var(--crm-color-border)',
  borderRadius: 8,
};

export function SubirImagenBtn({ preset: presetId, onData, small = true, children = 'Subir imagen' }) {
  const preset = PRESETS_IMAGEN[presetId];
  const inputRef = useRef(null);
  const [aviso, setAviso] = useState('');
  // { img, dataUrl, kb, fondoQuitado, tolerancia } — `img` queda para re-procesar.
  const [prev, setPrev] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 4500); };

  const procesar = (img, { fondoQuitado, tolerancia }) => {
    const canvas = moldear(img, preset);
    if (fondoQuitado) quitarFondo(canvas, tolerancia);
    const { dataUrl, kb } = exportar(canvas, preset, { fondoQuitado });
    return { img, dataUrl, kb, fondoQuitado, tolerancia };
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    if (file.size > MAX_ENTRADA_MB * 1024 * 1024) {
      avisar(`El archivo pesa ${Math.round(file.size / 1024 / 1024)} MB: hasta ${MAX_ENTRADA_MB} MB.`);
      return;
    }
    setProcesando(true);
    try {
      const img = await cargarImagen(file);
      setPrev(procesar(img, { fondoQuitado: false, tolerancia: 30 }));
    } catch {
      avisar('No se pudo leer esa imagen: probá con un JPG, PNG o WebP.');
    } finally {
      setProcesando(false);
    }
  };

  const reprocesar = (cambios) => {
    if (!prev) return;
    setPrev((p) => procesar(p.img, { fondoQuitado: p.fondoQuitado, tolerancia: p.tolerancia, ...cambios }));
  };

  const usar = () => {
    if (!prev) return;
    onData(prev.dataUrl);
    setPrev(null);
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <Btn small={small} onClick={() => inputRef.current?.click()} disabled={procesando}>
        {procesando ? 'Procesando…' : children}
      </Btn>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
      {aviso && <span style={{ fontSize: 11, color: 'var(--crm-color-danger)' }}>{aviso}</span>}

      {prev && (
        <ModalShell
          title={preset.titulo}
          wide
          onClose={() => setPrev(null)}
          footer={[
            { texto: 'Cancelar', clase: 'btn-ghost', onClick: () => setPrev(null) },
            { texto: `Usar imagen (${prev.kb} KB)`, clase: 'btn-primary', onClick: usar },
          ]}
        >
          <div className={s.hint} style={{ marginTop: 0 }}>
            Así queda en el sitio ({preset.ancho}×{preset.alto}
            {preset.modo === 'cubrir' ? ' — lo que sobraba se recortó al centro' : ' — la imagen entró entera'}).
          </div>

          <div style={{ ...CUADRICULA, padding: 10, display: 'flex', justifyContent: 'center' }}>
            <img
              src={prev.dataUrl}
              alt="Vista previa"
              style={{ maxWidth: '100%', maxHeight: 380, aspectRatio: `${preset.ancho} / ${preset.alto}` }}
            />
          </div>

          {preset.quitarFondo && (
            <div className={s.card} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {!prev.fondoQuitado ? (
                <>
                  <Btn small onClick={() => reprocesar({ fondoQuitado: true })}>Quitar fondo</Btn>
                  <span className={s.hint} style={{ margin: 0 }}>
                    Detecta el fondo desde los bordes y lo vuelve transparente. Funciona mejor con fondos lisos y claros.
                  </span>
                </>
              ) : (
                <>
                  <Btn small onClick={() => reprocesar({ fondoQuitado: false })}>Restaurar fondo</Btn>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    Tolerancia
                    <input
                      type="range" min="5" max="70" step="5"
                      value={prev.tolerancia}
                      onChange={(e) => reprocesar({ tolerancia: Number(e.target.value) })}
                    />
                    <span className={s.mono}>{prev.tolerancia}</span>
                  </label>
                  <span className={s.hint} style={{ margin: 0 }}>
                    Si quedaron restos de fondo, subila; si se comió parte del producto, bajala.
                  </span>
                </>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </span>
  );
}
