import { PanelHead } from '@modules/productos/components/ui.jsx';
import { ResumenFijos } from './ResumenFijos.jsx';
import { GastosFijosEmbebido } from '@modules/gastos/pages/FijosEmbebido.jsx';

/**
 * GERENCIA › GASTOS FIJOS Y SUELDOS (5/11/2026, pedido del dueño: «llevame a
 * un botón solo en el side de gerencia»). Antes era la primera parte de
 * Resultados › Configuración; es la misma pantalla, mudada: arriba lo fijo de
 * cada local con su venta necesaria y abajo gastos fijos, sueldos y bienes de
 * uso. Misma llave que Resultados (solo el superadmin).
 */
export function GastosFijosPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <PanelHead
        title="Gastos fijos y sueldos"
        desc="Lo fijo de cada local y cuánto tiene que vender para cubrirlo. Abajo se cargan los gastos fijos, los sueldos y los bienes de uso que usa el estado de resultados."
      />
      <ResumenFijos />
      <GastosFijosEmbebido />
    </div>
  );
}
