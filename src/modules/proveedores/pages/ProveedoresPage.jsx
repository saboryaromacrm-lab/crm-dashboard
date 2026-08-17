import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProveedoresProvider } from '../context/ProveedoresContext.jsx';
import { ProveedoresShell } from './ProveedoresShell.jsx';
import { PROVEEDORES_PANELS } from '../config/proveedores.config.js';

/** Página del módulo Proveedores: el menú interno se arma con lo permitido. */
export function ProveedoresPage() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const panels = useMemo(() => PROVEEDORES_PANELS.filter((p) => can(p.permiso)), [can]);

  const pedido = searchParams.get('panel');
  const defaultPanel = panels.some((p) => p.id === pedido) ? pedido : panels[0]?.id;

  return (
    <ProveedoresProvider panels={panels} defaultPanel={defaultPanel}>
      <ProveedoresShell
        title="Proveedores"
        subtitle="Pedidos, cuentas corrientes, echeqs y estados de cuenta"
      />
    </ProveedoresProvider>
  );
}
