import { useState } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useProveedores } from '../context/ProveedoresContext.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { Btn, s } from '../components/ui.jsx';

import { PedidosPanel } from '../panels/PedidosPanel.jsx';
import { CtasCtesPanel } from '../panels/CtasCtesPanel.jsx';
import { EcheqsPanel } from '../panels/EcheqsPanel.jsx';
import { EdocPanel } from '../panels/EdocPanel.jsx';
import { PadronPanel } from '../panels/PadronPanel.jsx';

/** Los `id` coinciden con `PROVEEDORES_PANELS` (config). */
const PANEL_COMPONENTS = {
  pedidos: PedidosPanel,
  ctasctes: CtasCtesPanel,
  echeqs: EcheqsPanel,
  edoc: EdocPanel,
  padron: PadronPanel,
};

/** Shell del módulo Proveedores: misma estructura que Gastos y Ventas. */
export function ProveedoresShell({ title, subtitle }) {
  const {
    loaded, loadError, recargar, panels, panel, goPanel, contadores,
    toastState, closeToast, toast,
  } = useProveedores();
  const [refrescando, setRefrescando] = useState(false);

  const primero = panels[0]?.id;
  const visible = panels.some((x) => x.id === panel) ? panel : primero;
  const ActivePanel = (visible && PANEL_COMPONENTS[visible]) || null;

  const onRefresh = async () => {
    setRefrescando(true);
    try { await recargar(); toast('Datos actualizados.', 'ok'); }
    catch { toast('No se pudo actualizar.', 'err'); }
    finally { setRefrescando(false); }
  };

  if (!loaded) return <FullScreenLoader label="Cargando proveedores…" />;

  if (loadError) {
    return (
      <div>
        <PageHeader title={title} subtitle={subtitle} />
        <div className={cx(s.callout, s.warn)} style={{ maxWidth: 640 }}>
          No se pudo cargar la información desde la API: <strong>{loadError}</strong>
          <div style={{ marginTop: 10 }}>
            <Btn variant="btn-primary" small onClick={onRefresh}>Reintentar</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={refrescando}>
            Actualizar
          </Button>
        }
      />

      <div className={s.shell}>
        <nav className={s.subnav} aria-label={`Secciones de ${title}`}>
          {panels.map((pnl) => {
            const Icon = pnl.icon;
            const count = pnl.badge ? contadores[pnl.badge] ?? 0 : 0;
            return (
              <button
                key={pnl.id}
                type="button"
                className={cx(s.subnavItem, panel === pnl.id && s.subnavItemActive)}
                onClick={() => goPanel(pnl.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{pnl.label}</span>
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
