import { useState } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { Btn, s } from '../components/ui.jsx';

import { DashboardPanel } from '../panels/DashboardPanel.jsx';
import { ProductosPanel } from '../panels/ProductosPanel.jsx';
import { CatalogosPanel } from '../panels/CatalogosPanel.jsx';
import { ProveedoresPanel } from '../panels/ProveedoresPanel.jsx';
import { FacturacionPanel } from '../panels/FacturacionPanel.jsx';
import { LecturasPanel } from '../panels/LecturasPanel.jsx';
import { ExistenciasPanel } from '../panels/ExistenciasPanel.jsx';
import { FraccionamientoPanel } from '../panels/FraccionamientoPanel.jsx';
import { HistorialPanel } from '../panels/HistorialPanel.jsx';
import { TransferenciasPanel } from '../panels/TransferenciasPanel.jsx';
import { OperacionesPanel } from '../panels/OperacionesPanel.jsx';
import { IncidenciasPanel } from '../panels/IncidenciasPanel.jsx';
import { CafeteriaPanel } from '../panels/CafeteriaPanel.jsx';
import { CafeteriaPedidosPanel } from '../panels/CafeteriaPedidosPanel.jsx';

/** Registro de paneles disponibles. Cada módulo elige cuáles muestra (config). */
const PANEL_COMPONENTS = {
  dashboard: DashboardPanel,
  productos: ProductosPanel,
  catalogos: CatalogosPanel,
  proveedores: ProveedoresPanel,
  lecturas: LecturasPanel,
  facturacion: FacturacionPanel,
  existencias: ExistenciasPanel,
  fraccionamiento: FraccionamientoPanel,
  historial: HistorialPanel,
  transferencias: TransferenciasPanel,
  operaciones: OperacionesPanel,
  incidencias: IncidenciasPanel,
  cafeteria: CafeteriaPanel,
  // La pantalla del rol Cafetería: armar el pedido a la distribuidora.
  'cafeteria-pedidos': CafeteriaPedidosPanel,
};

/**
 * Shell genérico del subsistema de inventario: cabecera + sub-sidebar + panel
 * activo. Lo comparten los módulos Compras y Almacén; cada uno pasa su propio
 * `panels` (vía el provider) y su `title`/`subtitle`. El puesto de trabajo
 * (usuario, rol y sucursal) sale de la sesión y se ve en el encabezado.
 */
export function InventoryShell({ title, subtitle }) {
  const { store, panels, panel, goPanel, toast, toastState, closeToast } = useProductos();
  const [refreshing, setRefreshing] = useState(false);

  const counts = {
    incidencias: store.incidenciasAbiertas().length,
    transferencias: store.transferenciasPendientes().length,
    // Facturas de papel esperando que alguien las cargue: sin el aviso, el papel
    // se queda en la bandeja como se quedaba en el cajón.
    lecturas: store.state.lecturasPendientes || 0,
    // La demanda del café que espera: pedidos pendientes o armándose.
    pedidosCafe: store.state.pedidosCafeteriaPendientes || 0,
  };

  // Solo se renderiza lo PERMITIDO: si el panel pedido no está en el menú del
  // rol (link viejo, atajo, URL), cae al primero visible — nunca a uno oculto.
  const first = panels[0]?.id;
  const visible = panels.some((x) => x.id === panel) ? panel : first;
  const ActivePanel = (visible && PANEL_COMPONENTS[visible]) || null;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await store.refetch(); toast('Datos actualizados.', 'ok'); }
    catch (e) { toast('No se pudo actualizar.', 'err'); }
    finally { setRefreshing(false); }
  };

  // Estado de carga inicial contra la API.
  if (!store.loaded) {
    if (store.loadError) {
      return (
        <div>
          <PageHeader title={title} subtitle={subtitle} />
          <div className={cx(s.callout, s.warn)} style={{ maxWidth: 640 }}>
            No se pudo cargar la información desde la API: <strong>{store.loadError}</strong>
            <div style={{ marginTop: 10 }}>
              <Btn variant="btn-primary" small onClick={onRefresh}>Reintentar</Btn>
            </div>
            <div className={s.hint} style={{ marginTop: 8 }}>
              Verificá que el backend esté corriendo (crm-api: <code>npm run start:dev</code>) en http://localhost:3001/api.
            </div>
          </div>
        </div>
      );
    }
    return <FullScreenLoader label="Cargando datos…" />;
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={refreshing}>
            Actualizar
          </Button>
        }
      />

      {/* El puesto de trabajo (usuario + sucursal + rol) vive en la sesión y se
          ve arriba, al lado del perfil: acá sería repetirlo. */}

      {/* Shell: sub-navegación + contenido del panel */}
      <div className={s.shell}>
        <nav className={s.subnav} aria-label={'Secciones de ' + title}>
          {panels.map((p) => {
            const Icon = p.icon;
            const count = p.badge ? counts[p.badge] : 0;
            return (
              <button
                key={p.id}
                type="button"
                className={cx(s.subnavItem, panel === p.id && s.subnavItemActive)}
                onClick={() => goPanel(p.id)}
              >
                <span className={s.subnavIcon}>
                  <Icon fontSize="small" />
                </span>
                <span className={s.subnavLabel}>{p.label}</span>
                {count > 0 && <span className={s.subnavBadge}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className={s.content}>
          {ActivePanel ? <ActivePanel /> : (
            <div className={cx(s.callout, s.warn)}>
              Tu rol no tiene ninguna sección habilitada en este módulo.
            </div>
          )}
        </div>
      </div>

      <ModalHost />

      {/* Arriba a la derecha: los modales grandes tapaban el aviso de abajo y
          los errores de una acción no se llegaban a leer. */}
      <Snackbar
        open={toastState.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={closeToast}
          severity={toastState.kind === 'err' ? 'error' : 'success'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toastState.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}
