/**
 * MODO RÁFAGA (25/8) — la otra mitad de las fotos en lote.
 * ============================================================================
 * El lote empareja por NOMBRE de archivo, que es como vienen los catálogos de
 * los proveedores. Pero las fotos propias salen del celular como IMG_2043.jpg:
 * ahí no hay nada que emparejar, y el que sabe qué producto es la foto es el
 * que la está mirando.
 *
 * Este modo da vuelta el orden: recorre SOLO los productos sin foto, te
 * muestra CUÁL toca, y vos soltás su foto — se procesa con el molde de
 * siempre, se guarda sola y pasa al siguiente. Una acción por producto, sin
 * modal de confirmación en el medio: la vista previa del resultado es la
 * miniatura que queda en la lista, y si una salió mal se la reemplaza por el
 * botón de siempre (o volviendo a entrar acá, porque un producto con foto ya
 * no aparece).
 */
import { useMemo, useRef, useState } from 'react';
import { httpClient } from '@core/services/httpClient.js';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import {
  MAX_ENTRADA_MB, PRESETS_IMAGEN, cargarImagen, moldear, exportar,
} from '../services/imagenes.js';

export function RafagaFotosModal({ productos, onCerrar, onListo, avisar }) {
  /* La lista se congela al abrir: si se recargara con cada subida, el índice
   * bailaría abajo de los pies (el recién subido desaparece de "sin foto"). */
  const pendientes = useMemo(() => productos.filter((p) => !p.imagenUrl), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const [hechas, setHechas] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef(null);

  const actual = pendientes[idx];
  const quedan = pendientes.length - idx;

  const procesarArchivo = async (file) => {
    if (!file || !actual || ocupado) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { avisar('err', 'Esa no es una imagen JPG, PNG ni WebP.'); return; }
    if (file.size > MAX_ENTRADA_MB * 1024 * 1024) { avisar('err', `El archivo pesa más de ${MAX_ENTRADA_MB} MB.`); return; }
    setOcupado(true);
    try {
      const img = await cargarImagen(file);
      const canvas = moldear(img, PRESETS_IMAGEN.producto);
      const { dataUrl } = exportar(canvas, PRESETS_IMAGEN.producto, { fondoQuitado: false });
      await httpClient.post(`/web/imagenes/producto/${actual.id}`, { data: dataUrl });
      setHechas((n) => n + 1);
      setIdx((i) => i + 1);
    } catch (e) {
      avisar('err', e?.data?.message || `No se pudo subir la foto de ${actual.nombre}.`);
    } finally { setOcupado(false); }
  };

  const cerrar = () => { if (hechas) onListo(); onCerrar(); };

  return (
    <ModalShell
      title="Modo ráfaga — fotos de los productos sin foto"
      subtitle="Mirá qué producto toca y soltale su foto: se guarda sola y pasa al siguiente. Para archivos del celular, sin renombrar nada."
      onClose={cerrar}
      footer={[
        ...(actual ? [{ texto: 'Saltear este producto', onClick: () => setIdx((i) => i + 1), disabled: ocupado }] : []),
        { texto: hechas ? `Cerrar (${hechas} subida${hechas === 1 ? '' : 's'})` : 'Cerrar', onClick: cerrar, disabled: ocupado },
      ]}
    >
      {!actual ? (
        <div className={s.callout} style={{ margin: 0 }}>
          {pendientes.length === 0
            ? 'No queda ningún producto sin foto. 🎉'
            : `Se recorrieron los ${pendientes.length} sin foto: ${hechas} subida(s). Los salteados van a volver a aparecer la próxima vez.`}
        </div>
      ) : (
        <>
          <div className={s.hint} style={{ margin: '0 0 8px' }}>
            {idx + 1} de {pendientes.length} sin foto ({quedan} por delante) · {hechas} subida(s) en esta pasada
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); procesarArchivo(e.dataTransfer?.files?.[0]); }}
            style={{
              border: '2px dashed var(--crm-color-primary, #166534)',
              borderRadius: 'var(--crm-radius-md)',
              padding: '34px 18px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              opacity: ocupado ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800 }}>{actual.nombre}</div>
            <div className={s.muted}>{actual.marca || 'Sin marca'}</div>
            <div className={s.hint} style={{ margin: 0 }}>
              {ocupado ? 'Procesando y subiendo…' : 'Soltá acá la foto de ESTE producto (JPG, PNG o WebP)'}
            </div>
            <Btn small onClick={() => inputRef.current?.click()} disabled={ocupado}>Elegir archivo</Btn>
            <input
              ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => { procesarArchivo(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </>
      )}
    </ModalShell>
  );
}
