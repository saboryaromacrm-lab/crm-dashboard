import { VentasProvider } from '../context/VentasContext.jsx';
import { VentasShell } from './VentasShell.jsx';
import { VENTAS_PANELS } from '../config/ventas.config.js';

/** Página del módulo Ventas (clientes, cobranzas y configuración del circuito). */
export function VentasPage() {
  return (
    <VentasProvider panels={VENTAS_PANELS} defaultPanel="pos">
      <VentasShell
        title="Ventas"
        subtitle="Punto de venta, clientes, cobranzas y caja"
      />
    </VentasProvider>
  );
}
