/**
 * CAMBIOS DE PRECIO — panel del menú de Ventas
 * ============================================================================
 * La misma vista que abre el atajo **Alt+F5**, acá con más filas visibles.
 * Comparten componente: si el filtro o la variación cambian, cambian en los
 * dos lados — no hay forma de que el modal y el panel muestren cosas distintas.
 */
import { CambiosPrecioVista } from '@modules/consultas/vistas.jsx';
import { PanelHead } from '../components/ui.jsx';

export function CambiosPrecioPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <PanelHead
        title="Cambios de precio"
        desc="Cada vez que el precio de góndola de una lista cambió: cuánto valía, cuánto pasó a valer, la variación y qué lo movió. Se abre desde cualquier pantalla con Alt+F5."
      />
      <CambiosPrecioVista />
    </div>
  );
}
