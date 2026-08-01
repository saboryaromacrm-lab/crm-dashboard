import { useState } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { Btn, s } from '../components/ui.jsx';

import { PosPanel } from '../panels/PosPanel.jsx';
import { ClientesPanel } from '../panels/ClientesPanel.jsx';
import { CobranzasPanel } from '../panels/CobranzasPanel.jsx';
import { CajaPanel } from '../panels/CajaPanel.jsx';
import { ConfiguracionPanel } from '../panels/ConfiguracionPanel.jsx';

/** Los `id` coinciden con `VENTAS_PANELS` (config/ventas.config.js). */
const PANEL_COMPONENTS = {
  pos: PosPanel,
  clientes: ClientesPanel,
  cobranzas: CobranzasPanel,
  caja: CajaPanel,
  configuracion: ConfiguracionPanel,
};

/**
 * Shell del módulo Ventas: cabecera + barra de puesto (sucursal/usuario) +
 * sub-sidebar + panel activo. Misma estructura que el shell de inventario para
 * que moverse entre módulos no cambie de idioma visual.
 */
export function VentasShell({ title, subtitle }) {
  const {
    loaded, loadError, recargar, panels, panel, goPanel,
    ctx, setCtx, sucursales, usuarios, toast, toastState, closeToast,
  } = useVentas();
  const [refrescando, setRefrescando] = useState(false);

  const primero = panels[0]?.id || 'clientes';
  const ActivePanel = PANEL_COMPONENTS[panel] || PANEL_COMPONENTS[primero];

  const onRefresh = async () => {
    setRefrescando(true);
    try { await recargar(); toast('Datos actualizados.', 'ok'); }
    catch { toast('No se pudo actualizar.', 'err'); }
    finally { setRefrescando(false); }
  };

  if (!loaded) return <FullScreenLoader label="Cargando ventas…" />;

  if (loadError) {
    return (
      <div>
        <PageHeader title={title} subtitle={subtitle} />
        <div className={cx(s.callout, s.warn)} style={{ maxWidth: 640 }}>
          No se pudo cargar la información desde la API: <strong>{loadError}</strong>
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

      {/* Puesto de trabajo: queda grabado en el navegador y sella los recibos. */}
      <div className={s.ctxbar} style={{ marginBottom: 'var(--crm-space-5)' }}>
        <label className={s.ctxField}>
          <span>Sucursal</span>
          <select
            className={s['select-inline']}
            value={ctx.sucursalId ?? ''}
            onChange={(e) => setCtx('sucursalId', e.target.value ? Number(e.target.value) : null)}
          >
            {sucursales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        <label className={s.ctxField}>
          <span>Usuario</span>
          <select
            className={s['select-inline']}
            value={ctx.usuarioId ?? ''}
            onChange={(e) => setCtx('usuarioId', e.target.value ? Number(e.target.value) : null)}
          >
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
      </div>

      <div className={s.shell}>
        <nav className={s.subnav} aria-label={`Secciones de ${title}`}>
          {panels.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                className={cx(s.subnavItem, panel === p.id && s.subnavItemActive)}
                onClick={() => goPanel(p.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
                <span className={s.subnavLabel}>{p.label}</span>
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
        autoHideDuration={3500}
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
