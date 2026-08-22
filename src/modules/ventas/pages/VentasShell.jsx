import { useState, useSyncExternalStore } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ordenesWeb } from '@core/services/ordenesWeb.js';
import { useVentas } from '../context/VentasContext.jsx';
import { ModalHost } from '../components/ModalHost.jsx';
import { Btn, s } from '../components/ui.jsx';

import { PosPanel } from '../panels/PosPanel.jsx';
import { ListadoVentasPanel } from '../panels/ListadoVentasPanel.jsx';
import { OrdenesPanel } from '../panels/OrdenesPanel.jsx';
import { PresupuestosPanel } from '../panels/PresupuestosPanel.jsx';
import { ClientesPanel } from '../panels/ClientesPanel.jsx';
import { CobranzasPanel } from '../panels/CobranzasPanel.jsx';
import { CajaPanel } from '../panels/CajaPanel.jsx';
import { ListasPanel } from '../panels/ListasPanel.jsx';
import { OfertasPanel } from '../panels/OfertasPanel.jsx';
import { CambiosPrecioPanel } from '../panels/CambiosPrecioPanel.jsx';
import { CartelesPanel } from '../panels/CartelesPanel.jsx';
import { ConfiguracionPanel } from '../panels/ConfiguracionPanel.jsx';

/** Los `id` coinciden con `VENTAS_PANELS` (config/ventas.config.js). */
const PANEL_COMPONENTS = {
  pos: PosPanel,
  listado: ListadoVentasPanel,
  ordenes: OrdenesPanel,
  presupuestos: PresupuestosPanel,
  clientes: ClientesPanel,
  cobranzas: CobranzasPanel,
  caja: CajaPanel,
  listas: ListasPanel,
  ofertas: OfertasPanel,
  cambiosPrecio: CambiosPrecioPanel,
  carteles: CartelesPanel,
  configuracion: ConfiguracionPanel,
};

/**
 * Shell del módulo Ventas: cabecera + sub-sidebar + panel activo. Misma
 * estructura que el shell de inventario para que moverse entre módulos no
 * cambie de idioma visual.
 */
export function VentasShell({ title, subtitle }) {
  const {
    loaded, loadError, recargar, panels, panel, goPanel, toast, toastState, closeToast,
  } = useVentas();
  const [refrescando, setRefrescando] = useState(false);

  // Contador vivo de pedidos web sin revisar (mismo poller que el sidebar).
  const pendientesWeb = useSyncExternalStore(ordenesWeb.subscribe, ordenesWeb.count, ordenesWeb.count);
  const counts = { ordenes: pendientesWeb };

  // Solo se renderiza lo PERMITIDO: si el panel pedido no está en el menú del
  // rol (link viejo, atajo, URL), cae al primero visible — nunca a uno oculto.
  const primero = panels[0]?.id;
  const visible = panels.some((x) => x.id === panel) ? panel : primero;
  const ActivePanel = (visible && PANEL_COMPONENTS[visible]) || null;

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

      {/* El puesto de trabajo (usuario + sucursal) vive en la sesión y se ve
          arriba, al lado del perfil: acá sería repetirlo. */}
      <div className={s.shell}>
        <nav className={s.subnav} aria-label={`Secciones de ${title}`}>
          {panels.map((p) => {
            const Icon = p.icon;
            const count = p.badge ? counts[p.badge] ?? 0 : 0;
            return (
              <button
                key={p.id}
                type="button"
                className={cx(s.subnavItem, panel === p.id && s.subnavItemActive)}
                onClick={() => goPanel(p.id)}
              >
                <span className={s.subnavIcon}><Icon fontSize="small" /></span>
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
