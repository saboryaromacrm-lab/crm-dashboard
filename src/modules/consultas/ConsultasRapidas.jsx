/**
 * CONSULTAS RÁPIDAS — atajos globales de teclado
 * ============================================================================
 *   Alt + F5  →  Cambios de precio
 *   Alt + F3  →  Existencias por sucursal
 *
 * Se montan en el LAYOUT, no en un módulo: son consultas que se hacen desde
 * donde uno esté (cargando una compra, en la caja, mirando el stock) y en el
 * sistema viejo se abren igual desde cualquier pantalla del ERP. Estuvieron
 * dentro del shell de Ventas y por eso no andaban en el resto del sistema.
 *
 * El listener va en FASE DE CAPTURA para llegar antes que cualquier otro
 * manejador y antes de la acción por defecto del navegador — F5 recarga la
 * página, así que si no se cancela a tiempo el modal nunca llega a abrirse.
 */
import { useCallback, useEffect, useState } from 'react';
import { ModalShell } from '@modules/productos/components/Modal.jsx';
import { CambiosPrecioVista, ExistenciasVista } from './vistas.jsx';

/** Cada consulta con su tecla y su título. Agregar una es agregar una entrada. */
const CONSULTAS = {
  precios: {
    tecla: 'F5',
    titulo: 'Cambios de precio',
    ayuda: 'Cada vez que cambió el precio de góndola, con su variación y el motivo.',
    Vista: CambiosPrecioVista,
  },
  stock: {
    tecla: 'F3',
    titulo: 'Existencias',
    ayuda: 'Stock de cada artículo en todas las sucursales, con sus precios finales (IVA incluido).',
    Vista: ExistenciasVista,
  },
};

export function ConsultasRapidas() {
  const [abierta, setAbierta] = useState(null);
  const cerrar = useCallback(() => setAbierta(null), []);

  useEffect(() => {
    const onKey = (e) => {
      // Solo Alt: con Ctrl o Meta encima es otro atajo (del navegador o del SO).
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      // `code` es la tecla física y no cambia con los modificadores ni con el
      // layout del teclado; `key` queda de respaldo.
      const tecla = e.code || e.key;
      const id = Object.keys(CONSULTAS).find((k) => CONSULTAS[k].tecla === tecla);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      // Volver a apretar el mismo atajo cierra: la consulta es de ida y vuelta.
      setAbierta((actual) => (actual === id ? null : id));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (!abierta) return null;
  const { titulo, ayuda, Vista, tecla } = CONSULTAS[abierta];

  return (
    <ModalShell
      title={`${titulo} · Alt+${tecla}`}
      subtitle={ayuda}
      onClose={cerrar}
      size="xl"
      footer={[{ texto: 'Cerrar (Esc)', clase: 'btn-ghost', onClick: cerrar }]}
    >
      <Vista compacto />
    </ModalShell>
  );
}
