import { Button, Snackbar, Alert } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useProductos } from '../context/ProductosContext.jsx';
import { ROLES } from '../domain/constants.js';
import { sucursalOptions, usuarioOptions } from '../components/selectOptions.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { s } from '../components/ui.jsx';

import { DashboardPanel } from '../panels/DashboardPanel.jsx';
import { ProductosPanel } from '../panels/ProductosPanel.jsx';
import { ProveedoresPanel } from '../panels/ProveedoresPanel.jsx';
import { FacturacionPanel } from '../panels/FacturacionPanel.jsx';
import { ExistenciasPanel } from '../panels/ExistenciasPanel.jsx';
import { FraccionamientoPanel } from '../panels/FraccionamientoPanel.jsx';
import { HistorialPanel } from '../panels/HistorialPanel.jsx';
import { SucursalesPanel } from '../panels/SucursalesPanel.jsx';
import { TransferenciasPanel } from '../panels/TransferenciasPanel.jsx';
import { IncidenciasPanel } from '../panels/IncidenciasPanel.jsx';

/** Registro de paneles disponibles. Cada módulo elige cuáles muestra (config). */
const PANEL_COMPONENTS = {
  dashboard: DashboardPanel,
  productos: ProductosPanel,
  proveedores: ProveedoresPanel,
  facturacion: FacturacionPanel,
  existencias: ExistenciasPanel,
  fraccionamiento: FraccionamientoPanel,
  historial: HistorialPanel,
  sucursales: SucursalesPanel,
  transferencias: TransferenciasPanel,
  incidencias: IncidenciasPanel,
};

/**
 * Shell genérico del subsistema de inventario: cabecera + barra de contexto
 * (sucursal + usuario/rol) + sub-sidebar + panel activo. Lo comparten los
 * módulos Compras y Almacén; cada uno pasa su propio `panels` (vía el provider)
 * y su `title`/`subtitle`.
 */
export function InventoryShell({ title, subtitle }) {
  const { store, panels, panel, goPanel, ctx, openModal, toast, toastState, closeToast } = useProductos();

  const counts = {
    incidencias: store.incidenciasAbiertas().length,
    transferencias: store.transferenciasPendientes().length,
  };

  const first = panels[0]?.id || 'dashboard';
  const ActivePanel = PANEL_COMPONENTS[panel] || PANEL_COMPONENTS[first] || DashboardPanel;

  const onReset = () =>
    openModal('confirm', {
      title: 'Restablecer datos',
      texto: 'Se borrarán los datos actuales y se cargarán los de ejemplo. ¿Confirmás?',
      claseOk: 'btn-delete',
      onOk: () => {
        store.reset();
        goPanel(first);
        toast('Datos de ejemplo cargados.', 'ok');
      },
    });

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={onReset}>
            Datos de ejemplo
          </Button>
        }
      />

      {/* Barra de contexto: sucursal operativa + usuario/rol activo */}
      <div className={s.ctxbar} style={{ marginBottom: 'var(--crm-space-5)' }}>
        <label className={s.ctxField}>
          <span>Sucursal</span>
          <select
            className={s['select-inline']}
            value={ctx.sucursalId ?? ''}
            onChange={(e) => store.setCtx('sucursalId', e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            {sucursalOptions(store, true)}
          </select>
        </label>
        <label className={s.ctxField}>
          <span>Usuario / rol</span>
          <select
            className={s['select-inline']}
            value={ctx.usuarioId ?? ''}
            onChange={(e) => store.setCtx('usuarioId', parseInt(e.target.value, 10))}
          >
            {usuarioOptions(store)}
          </select>
        </label>
        <span className={s.ctxSpacer} />
        <span className={s.ctxField} style={{ textTransform: 'none' }}>
          <span>Rol activo</span>
          <strong style={{ color: 'var(--crm-color-text)', fontSize: 13 }}>
            {ROLES[store.rolActual()]?.label || store.rolActual()}
          </strong>
        </span>
      </div>

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
          <ActivePanel />
        </div>
      </div>

      <ModalHost />

      <Snackbar
        open={toastState.open}
        autoHideDuration={3000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
