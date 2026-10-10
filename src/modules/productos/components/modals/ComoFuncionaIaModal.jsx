/**
 * CÓMO SE CARGAN LAS FACTURAS CON LA IA (10/10/2026) — la guía corta para quien
 * carga las facturas. Solo texto: el detalle completo está en el manual.
 */
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../../context/ProductosContext.jsx';
import { ModalShell } from '../Modal.jsx';
import { s } from '../ui.jsx';

const PASOS = [
  {
    titulo: 'Subí las facturas',
    items: [
      'Tocá «+ Subir facturas» o arrastrá los archivos a la bandeja. PDF, fotos o escaneos, de a una o muchas juntas.',
      'Una factura de varias hojas: el PDF va entero. Si son fotos, subí la primera y en su ficha tocá «+ Sumar otra hoja (foto)». Cada foto subida suelta cuenta como otra factura.',
      'Desde el celular: erp.saboryaroma.com/facturas, para sacarle la foto al papel.',
    ],
  },
  {
    titulo: 'La IA la lee sola (unos segundos)',
    items: [
      'La columna IA muestra cómo quedó: «Leída ✓» (la cuenta cierra), «Leída · revisar» (algo no cierra: mirala con atención) o el error.',
      'Copia el encabezado, cada renglón y el pie. La cuenta la controla el sistema: renglones, subtotal, IVA, percepciones y total.',
    ],
  },
  {
    titulo: 'Abrí la factura y completá lo que falta',
    items: [
      '«Sucursal que recibió»: el papel no lo dice, lo sabe quien recibió la mercadería.',
      'El proveedor sale del CUIT. Si dice que el CUIT no está: si el proveedor ya existe, elegilo en «Proveedor» y tocá «Guardarle el CUIT»; si es nuevo, «darlo de alta con los datos del papel».',
      'Un papel interno (sin CAE ni letra: «Factura interna», presupuesto) queda como «Liquidación (sin factura)». No trae CUIT: el proveedor lo elegís vos.',
    ],
  },
  {
    titulo: 'Procesar: los productos',
    items: [
      'Se abre la carga con los renglones ya puestos. Los productos que el sistema conoce aparecen solos.',
      'Los que no reconoce: asocialos con «Asociar con un producto…» (los parecidos van primero) o con «Que la IA elija». Lo que elige la IA es solo una sugerencia: hay que tocar «Aceptar».',
      'Si el artículo no existe en el sistema, primero se crea en Productos. La IA nunca crea productos ni proveedores.',
    ],
  },
  {
    titulo: 'Revisar y guardar',
    items: [
      'Mirá que la cuenta cierre contra el total del papel, las cantidades y los bultos (la IA controla la plata, no las cantidades) y los precios a confirmar.',
      'Al guardar, la factura queda cargada y el archivo se borra.',
    ],
  },
];

export function ComoFuncionaIaModal() {
  const { closeModal } = useProductos();
  return (
    <ModalShell
      title="Cómo se cargan las facturas con la IA"
      subtitle="Paso a paso, para quien carga las facturas"
      wide
      onClose={closeModal}
      footer={[{ texto: 'Entendido', clase: 'btn-primary', onClick: closeModal }]}
    >
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {PASOS.map((p) => (
          <li key={p.titulo}>
            <strong>{p.titulo}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.items.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </li>
        ))}
      </ol>

      <div className={cx(s.callout, s.ok)} style={{ marginTop: 'var(--crm-space-4)' }}>
        <strong>Lo que asociás se aprende.</strong> Al guardar la factura, el sistema recuerda, para ese proveedor, qué
        producto es cada artículo del papel (por su código, o por la descripción si el papel no trae código). Desde la
        próxima factura de ese proveedor aparece solo. Si una vez lo asociás a otro producto, queda el último.
      </div>

      <div className={cx(s.callout, s.warn)}>
        <strong>Si algo sale mal:</strong> «Leer de nuevo» la vuelve a leer (no pisa lo que corregiste a mano). Si dice
        «Tope del mes», se llegó al gasto máximo: se carga a mano o se pide subir el tope. Ante cualquier duda, la
        factura queda en la bandeja sin cargar: no se pierde nada.
      </div>
    </ModalShell>
  );
}
