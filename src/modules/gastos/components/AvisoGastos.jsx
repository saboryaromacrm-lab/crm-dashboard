import { Snackbar, Alert } from '@mui/material';
import { useGastos } from '../context/GastosContext.jsx';

/**
 * El aviso de «guardado» / error del módulo Gastos. Abajo a la derecha, y por
 * ENCIMA de cualquier modal (23/9/2026): el aviso vivía arriba a la derecha y
 * en formularios largos —el "Guardar" queda abajo— pasaba lejos de donde
 * estaban mirando. El zIndex explícito evita que un modal grande lo tape.
 */
export function AvisoGastos() {
  const { toastState, closeToast } = useGastos();
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
