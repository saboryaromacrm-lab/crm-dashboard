/**
 * "¿POR QUÉ SALE UNA LÍNEA CON LA FECHA ARRIBA DE LA ETIQUETA?" (25/8)
 *
 * Esa línea la agrega CHROME al imprimir (su encabezado con fecha y título),
 * no el sistema, y desde el código no se puede apagar: es un control del
 * navegador. La primera tanda real del dueño salió con el encabezado pisando
 * la marca — y la explicación estaba en el chat, no en la pantalla. Este botón
 * la pone donde se necesita: al lado de Imprimir, en carteles y fraccionados.
 */
import { useState } from 'react';
import { cx } from '@shared/utils/classNames.js';
import { s } from './ui.jsx';

export function AyudaEncabezadoNavegador() {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      {/* En el color de info y con el signo adelante, no un botón gris más: la
          primera versión era un Btn fantasma al lado de todos los demás y el
          dueño no lo vio (25/8) — una ayuda que pasa desapercibida no ayuda. */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 6px',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid color-mix(in srgb, var(--crm-color-info) 45%, transparent)',
          background: 'color-mix(in srgb, var(--crm-color-info) 12%, transparent)',
          color: 'var(--crm-color-info)',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--crm-color-info)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
          }}
        >?</span>
        {abierta ? 'Cerrar la ayuda' : '¿Sale una línea con la fecha arriba de la etiqueta?'}
      </button>
      {abierta && (
        <div className={cx(s.callout, s.info)} style={{ marginTop: 8 }}>
          Esa línea gris (&ldquo;25/8/26, 12:02 · Carteles de góndola&rdquo;) <strong>la agrega
          Chrome</strong>, no el sistema: es el encabezado que el navegador le pone a lo que
          imprime. Se saca <strong>una sola vez</strong> y queda apagado para siempre:
          <ol style={{ margin: '8px 0 0', paddingLeft: 22 }}>
            <li>Apretá <strong>Imprimir</strong> para abrir el diálogo de Chrome.</li>
            <li>Clic en <strong>&ldquo;Más opciones&rdquo;</strong> (abajo, en el panel derecho).</li>
            <li>Destildá <strong>&ldquo;Encabezados y pies de página&rdquo;</strong>.</li>
            <li>En <strong>Márgenes</strong> elegí <strong>&ldquo;Ninguno&rdquo;</strong>.</li>
          </ol>
          Chrome recuerda esas dos opciones para todas las impresiones siguientes.
        </div>
      )}
    </div>
  );
}
