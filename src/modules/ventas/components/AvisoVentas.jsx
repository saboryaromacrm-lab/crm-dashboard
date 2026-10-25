import { Snackbar, Alert } from '@mui/material';
import { useVentas } from '../context/VentasContext.jsx';

/**
 * El aviso de Ventas (el `toast` del contexto). Abajo a la derecha, y por
 * ENCIMA de cualquier modal (23/9/2026): arriba pasaba lejos de donde estaban
 * mirando —el «Guardar» de un formulario largo queda abajo—, y un modal grande
 * lo tapaba. Lo usan el módulo Ventas y las secciones de Ventas que viven en
 * otro módulo (`SeccionVentas`).
 */
export function AvisoVentas() {
  const { toastState, closeToast } = useVentas();
  return (
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
  );
}
