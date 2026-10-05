/**
 * BOTÓN DE SUBIDA ESTÁNDAR de imágenes del sitio.
 * ============================================================================
 * Elegir archivo → el motor lo pasa por el MOLDE del preset → modal con la
 * vista previa del RESULTADO FINAL (lo que de verdad se va a ver) → opcional
 * "Quitar fondo" con tolerancia ajustable → Usar imagen.
 *
 * ENCUADRE Y PESO (5/10/2026, pedido del dueño): la foto se ARRASTRA dentro
 * del molde para acomodarla, se ACERCA con el zoom y «Centrar» la vuelve al
 * medio; en las fotos de producto, «Centrar el producto» recorta solo el fondo
 * que sobra. Se ve lo que pesaba el original y lo que va a pesar (siempre lo
 * menos posible: ver `exportar`). Mientras se arrastra se dibuja rápido; la
 * compresión corre recién al soltar.
 *
 * Este es el único camino de entrada de imágenes: un componente futuro que
 * lleve imagen declara su preset acá y hereda molde, compresión, quitado de
 * fondo y previsualización. Nada de <input type=file> sueltos por ahí.
 */
import { useEffect, useRef, useState } from 'react';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import {
  MAX_ENTRADA_MB, PRESETS_IMAGEN, ENCUADRE_INICIAL, cargarImagen, geometria, moldear, detectarContenido,
  quitarFondo, exportar, pesoLegible,
} from '../services/imagenes.js';

/** Fondo cuadriculado: hace visible la transparencia en la vista previa. */
const CUADRICULA = {
  background: 'repeating-conic-gradient(#e8ebe9 0% 25%, #ffffff 0% 50%) 0 / 18px 18px',
  border: '1px solid var(--crm-color-border)',
  borderRadius: 8,
};

/** Dibuja en el canvas visible lo que se va a subir (con el fondo del preset si no se quitó). */
function pintar(destino, origen, preset, fondoQuitado) {
  if (!destino) return;
  destino.width = origen.width;
  destino.height = origen.height;
  const ctx = destino.getContext('2d');
  ctx.clearRect(0, 0, destino.width, destino.height);
  if (preset.fondo && !fondoQuitado) { ctx.fillStyle = preset.fondo; ctx.fillRect(0, 0, destino.width, destino.height); }
  ctx.drawImage(origen, 0, 0);
}

export function SubirImagenBtn({ preset: presetId, onData, small = true, children = 'Subir imagen' }) {
  const preset = PRESETS_IMAGEN[presetId];
  const inputRef = useRef(null);
  const lienzo = useRef(null);
  const arrastre = useRef(null);
  const [aviso, setAviso] = useState('');
  /* La foto abierta: { img, archivoBytes, recorteAuto } y cómo se la encuadra. */
  const [foto, setFoto] = useState(null);
  const [encuadre, setEncuadre] = useState(ENCUADRE_INICIAL);
  const [centrarProducto, setCentrarProducto] = useState(true);
  const [fondoQuitado, setFondoQuitado] = useState(false);
  const [tolerancia, setTolerancia] = useState(30);
  const [moviendo, setMoviendo] = useState(false);
  const [resultado, setResultado] = useState(null); // { dataUrl, kb, calidad, formato }
  const [procesando, setProcesando] = useState(false);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 4500); };
  const recorte = foto && centrarProducto ? foto.recorteAuto : null;

  /* Dibujo + compresión. Arrastrando: solo el dibujo (rápido). Quieto: el
   * molde completo (con «quitar fondo» si va) y la compresión al peso mínimo. */
  useEffect(() => {
    if (!foto) return undefined;
    const canvas = moldear(foto.img, preset, encuadre, recorte);
    if (moviendo) { pintar(lienzo.current, canvas, preset, false); return undefined; }
    const t = setTimeout(() => {
      if (fondoQuitado) quitarFondo(canvas, tolerancia);
      pintar(lienzo.current, canvas, preset, fondoQuitado);
      setResultado(exportar(canvas, preset, { fondoQuitado }));
    }, 120);
    return () => clearTimeout(t);
  }, [foto, encuadre, recorte, fondoQuitado, tolerancia, moviendo, preset]);

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
      /* Centrar el producto solo vale para las fotos de producto (fondo blanco, entra entera). */
      const recorteAuto = presetId === 'producto' ? detectarContenido(img) : null;
      setEncuadre(ENCUADRE_INICIAL);
      setFondoQuitado(false);
      setTolerancia(30);
      setCentrarProducto(true);
      setResultado(null);
      setFoto({ img, archivoBytes: file.size, recorteAuto });
    } catch {
      avisar('No se pudo leer esa imagen: probá con un JPG, PNG o WebP.');
    } finally {
      setProcesando(false);
    }
  };

  /* ARRASTRAR PARA ACOMODAR: el movimiento del mouse (o del dedo) en la vista
   * previa se traduce a la posición de la foto dentro del molde. */
  const g = foto ? geometria(foto.img, preset, encuadre, recorte) : null;
  const puedeMover = !!g && (g.rangoX > 0.5 || g.rangoY > 0.5);
  const empezar = (e) => {
    if (!puedeMover) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    arrastre.current = { x: e.clientX, y: e.clientY, inicio: encuadre, k: preset.ancho / rect.width };
    setMoviendo(true);
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a || !g) return;
    const lim = (v) => Math.max(-1, Math.min(1, v));
    /* La foto sigue al mouse: x/y = desplazamiento en píxeles del molde sobre lo que se puede correr. */
    setEncuadre({
      ...a.inicio,
      x: g.rangoX > 0.5 ? lim(a.inicio.x + ((e.clientX - a.x) * a.k) / g.rangoX) : a.inicio.x,
      y: g.rangoY > 0.5 ? lim(a.inicio.y + ((e.clientY - a.y) * a.k) / g.rangoY) : a.inicio.y,
    });
  };
  const soltar = () => { arrastre.current = null; setMoviendo(false); };

  const cerrar = () => { setFoto(null); setResultado(null); };
  const usar = () => {
    if (!resultado || moviendo) return;
    onData(resultado.dataUrl);
    cerrar();
  };
  const ahorro = resultado && foto ? Math.max(0, Math.round(100 - (resultado.kb * 1024 * 100) / foto.archivoBytes)) : 0;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <Btn small={small} onClick={() => inputRef.current?.click()} disabled={procesando}>
        {procesando ? 'Procesando…' : children}
      </Btn>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
      {aviso && <span style={{ fontSize: 11, color: 'var(--crm-color-danger)' }}>{aviso}</span>}

      {foto && (
        <ModalShell
          title={preset.titulo}
          wide
          onClose={cerrar}
          footer={[
            { texto: 'Cancelar', clase: 'btn-ghost', onClick: cerrar },
            { texto: resultado ? `Usar imagen (${resultado.kb} KB)` : 'Preparando…', clase: 'btn-primary', onClick: usar, disabled: !resultado || moviendo },
          ]}
        >
          <div className={s.hint} style={{ marginTop: 0 }}>
            Original: <strong>{foto.img.width}×{foto.img.height}</strong> · {pesoLegible(foto.archivoBytes)}
            {' → '}queda <strong>{preset.ancho}×{preset.alto}</strong> · <strong>{resultado ? `${resultado.kb} KB` : '…'}</strong>
            {resultado && ahorro > 0 && <> (−{ahorro}% de peso)</>}
            {' — '}{preset.modo === 'cubrir' ? 'llena el cuadro: lo que no entra se corta.' : 'entra entera.'}
          </div>

          <div style={{ ...CUADRICULA, padding: 10, display: 'flex', justifyContent: 'center' }}>
            <canvas
              ref={lienzo}
              onPointerDown={empezar}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              title={puedeMover ? 'Arrastrá para acomodar la foto' : undefined}
              style={{
                maxWidth: '100%', maxHeight: 380, aspectRatio: `${preset.ancho} / ${preset.alto}`,
                cursor: puedeMover ? (moviendo ? 'grabbing' : 'grab') : 'default', touchAction: 'none',
                outline: '1px dashed rgba(0,0,0,.25)',
              }}
            />
          </div>

          <div className={s.card} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              Zoom
              <input
                type="range" min="1" max="3" step="0.05" value={encuadre.zoom}
                onChange={(e) => setEncuadre((v) => ({ ...v, zoom: Number(e.target.value) }))}
                aria-label="Acercar la foto"
              />
              <span className={s.mono}>{Math.round(encuadre.zoom * 100)}%</span>
            </label>
            <Btn small onClick={() => setEncuadre(ENCUADRE_INICIAL)} disabled={encuadre.zoom === 1 && !encuadre.x && !encuadre.y}>Centrar</Btn>
            {foto.recorteAuto && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={centrarProducto} onChange={(e) => { setCentrarProducto(e.target.checked); setEncuadre(ENCUADRE_INICIAL); }} />
                Centrar el producto (recorta el fondo que sobra)
              </label>
            )}
            <span className={s.hint} style={{ margin: 0 }}>
              {puedeMover ? 'Arrastrá la foto para acomodarla.' : 'Subí el zoom para poder acomodarla.'}
            </span>
          </div>

          {preset.quitarFondo && (
            <div className={s.card} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {!fondoQuitado ? (
                <>
                  <Btn small onClick={() => setFondoQuitado(true)}>Quitar fondo</Btn>
                  <span className={s.hint} style={{ margin: 0 }}>
                    Detecta el fondo desde los bordes y lo vuelve transparente. Funciona mejor con fondos lisos y claros.
                  </span>
                </>
              ) : (
                <>
                  <Btn small onClick={() => setFondoQuitado(false)}>Restaurar fondo</Btn>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    Tolerancia
                    <input type="range" min="5" max="70" step="5" value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} />
                    <span className={s.mono}>{tolerancia}</span>
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
