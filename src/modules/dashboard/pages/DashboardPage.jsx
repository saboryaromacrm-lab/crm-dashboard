import { useState } from 'react';
import { Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ProductosProvider, useProductos } from '@modules/productos/context/ProductosContext.jsx';
import { ResumenInventario } from '@modules/productos/panels/ResumenInventario.jsx';
import styles from '../styles/Dashboard.module.css';

/**
 * DASHBOARD — la pantalla que abre el sistema.
 * ============================================================================
 * Muestra el **resumen real del inventario**: valor disponible, productos,
 * stock bajo y comprometido, el stock por sucursal y los últimos movimientos.
 *
 * Hasta el 18/8/2026 esta página mostraba métricas de EJEMPLO —ventas de
 * $184.500, "Panadería El Sol", "María G."— que venían de la plantilla original
 * y nunca se cablearon, mientras el resumen de verdad estaba escondido en una
 * pestaña adentro de Compras. El dueño lo dio vuelta: el contenido real subió
 * acá y los datos inventados se fueron. Mostrar cifras falsas en la puerta de
 * entrada es peor que no mostrar nada — alguien las lee como si fueran ciertas.
 *
 * El resumen sale del **motor de inventario**, así que la página lo monta
 * dentro del `ProductosProvider` (igual que Compras y Almacén). Sin paneles: no
 * hay sub-menú, y los "Ver todo →" navegan por ruta.
 *
 * QUIÉN LO VE: el valor del inventario es información sensible, así que solo se
 * dibuja para quien ya puede ver esos datos en su módulo. Un rol de mostrador
 * entra al Dashboard y no ve el valor del depósito — antes tampoco lo veía, y
 * no es este cambio el que debería dárselo.
 */
const CLAVES_INVENTARIO = [
  'compras.productos', 'compras.facturacion', 'compras.historial', 'compras.catalogos',
  'almacen.existencias', 'almacen.operaciones',
];

/** Va adentro del Provider porque el botón Actualizar recarga EL STORE. */
function ResumenConHeader() {
  const { store } = useProductos();
  const [refreshing, setRefreshing] = useState(false);

  const refrescar = async () => {
    setRefreshing(true);
    try { await store.refetch(); } finally { setRefreshing(false); }
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="El estado del inventario, en una pantalla"
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refrescar}
            disabled={refreshing || !store.loaded}
          >
            Actualizar
          </Button>
        }
      />
      {store.loaded ? <ResumenInventario /> : <FullScreenLoader label="Cargando datos…" />}
    </>
  );
}

export function DashboardPage() {
  const { can } = usePermissions();
  const veInventario = CLAVES_INVENTARIO.some((clave) => can(clave));

  if (!veInventario) {
    return (
      <div className={styles.page}>
        <PageHeader title="Dashboard" subtitle="El estado del inventario, en una pantalla" />
        <p className={styles.sinAcceso}>
          Tu usuario no tiene acceso al inventario. Entrá por el menú al módulo con el que
          trabajás.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ProductosProvider panels={[]}>
        <ResumenConHeader />
      </ProductosProvider>
    </div>
  );
}
