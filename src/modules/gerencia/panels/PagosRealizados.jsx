/**
 * GERENCIA › PAGOS REALIZADOS (16/11/2026, pedido del dueño: «esta sección
 * llevala a gerencia»). Antes vivía en Compras.
 *
 * El listado es el mismo panel de siempre (`productos/panels/PagosRealizadosPanel`):
 * necesita el motor de inventario (proveedores, sucursales, la ventana del
 * detalle del pago y los avisos), así que acá se monta adentro de su provider,
 * con su ModalHost y su Snackbar, igual que lo hace el shell de Compras.
 */
import { Snackbar, Alert } from '@mui/material';
import { cx } from '@shared/utils/classNames.js';
import { ProductosProvider, useProductos } from '@modules/productos/context/ProductosContext.jsx';
import { ModalHost } from '@modules/productos/components/ModalHost.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';
import { PagosRealizadosPanel } from '@modules/productos/panels/PagosRealizadosPanel.jsx';

function Contenido() {
  const { store, toastState, closeToast } = useProductos();

  if (!store.loaded) {
    if (store.loadError) {
      return (
        <div className={cx(s.callout, s.warn)} style={{ maxWidth: 640 }}>
          No se pudieron cargar los proveedores y las sucursales: <strong>{store.loadError}</strong>
          <div style={{ marginTop: 10 }}>
            <Btn variant="btn-primary" small onClick={() => store.refetch()}>Reintentar</Btn>
          </div>
        </div>
      );
    }
    return <div className={s.hint}>Cargando…</div>;
  }

  return (
    <>
      <PagosRealizadosPanel />
      <ModalHost />
      <Snackbar
        open={toastState.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 50 }}
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
    </>
  );
}

export function PagosRealizados() {
  return (
    <ProductosProvider panels={[]}>
      <Contenido />
    </ProductosProvider>
  );
}
