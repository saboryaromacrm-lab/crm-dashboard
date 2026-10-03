import { Snackbar, Alert } from '@mui/material';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { cx } from '@shared/utils/classNames.js';
import { ProductosProvider, useProductos } from '@modules/productos/context/ProductosContext.jsx';
import { MargenesPanel } from '@modules/productos/panels/MargenesPanel.jsx';
import { ModalHost } from '@modules/productos/components/ModalHost.jsx';
import { Btn, s } from '@modules/productos/components/ui.jsx';

/*
 * LISTAS DE PRECIOS, AHORA EN VENTAS (3/10/2026, pedido del dueño): la misma
 * pantalla que estaba en Compras (el mapa de markups producto × lista), con el
 * mismo permiso (`compras.productos`: muestra costos). No se reescribió: se
 * monta con su propio contexto de productos, sus ventanas y su aviso, igual
 * que dentro de Compras — una sola pantalla, en un solo lugar.
 */
function Contenido() {
  const { store, toastState, closeToast } = useProductos();
  if (!store.loaded) {
    if (store.loadError) {
      return (
        <div className={cx(s.callout, s.warn)} style={{ maxWidth: 640 }}>
          No se pudieron cargar los productos: <strong>{store.loadError}</strong>
          <div style={{ marginTop: 10 }}>
            <Btn variant="btn-primary" small onClick={() => store.refetch()}>Reintentar</Btn>
          </div>
        </div>
      );
    }
    return <FullScreenLoader label="Cargando listas de precios…" />;
  }
  return (
    <>
      <MargenesPanel />
      <ModalHost />
      <Snackbar
        open={toastState.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 50 }}
      >
        <Alert onClose={closeToast} severity={toastState.kind === 'err' ? 'error' : 'success'} variant="filled" sx={{ width: '100%' }}>
          {toastState.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

export function ListasPreciosPanel() {
  return (
    <ProductosProvider panels={[]}>
      <Contenido />
    </ProductosProvider>
  );
}
