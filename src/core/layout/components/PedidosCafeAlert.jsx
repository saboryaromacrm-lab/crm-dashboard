/**
 * ALERTA DE PEDIDOS DE LA CAFETERÍA — el aviso vivo para el admin.
 * ============================================================================
 * Mismo diseño que la alerta de órdenes web (misma justificación, misma
 * disciplina): el primer tick NO alerta (lo que ya estaba al abrir se ve en
 * los badges), solo suena cuando el contador SUBE — entró un pedido nuevo del
 * café mientras el sistema está abierto — y solo lo ve la administración con
 * la sección Cafetería habilitada. Dos notas más graves que las de órdenes,
 * para que el oído las distinga sin mirar.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { pedidosCafe } from '@core/services/pedidosCafe.js';

function campanitaGrave() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const nota = (freq, t0, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t0);
      osc.stop(ctx.currentTime + t0 + dur + 0.05);
    };
    nota(659.25, 0, 0.28);   // Mi5
    nota(880, 0.16, 0.34);   // La5 — ascendente pero más grave que la de órdenes
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sin audio disponible: el aviso visual alcanza */ }
}

export function PedidosCafeAlert() {
  const { can, esAdmin } = usePermissions();
  const navigate = useNavigate();
  const count = useSyncExternalStore(pedidosCafe.subscribe, pedidosCafe.count, pedidosCafe.count);
  const [abierto, setAbierto] = useState(false);
  const previo = useRef(null);

  useEffect(() => {
    if (previo.current === null) { previo.current = count; return; }
    if (count > previo.current) {
      setAbierto(true);
      campanitaGrave();
    }
    previo.current = count;
  }, [count]);

  if (!esAdmin || !can('almacen.cafeteria')) return null;

  const irAPedidos = () => {
    setAbierto(false);
    navigate('/almacen?panel=cafeteria');
  };

  return (
    <Snackbar
      open={abierto && count > 0}
      autoHideDuration={10000}
      onClose={(e, reason) => { if (reason !== 'clickaway') setAbierto(false); }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        variant="filled"
        icon={<span style={{ fontSize: 18 }}>☕</span>}
        onClose={() => setAbierto(false)}
        action={(
          <Button color="inherit" size="small" onClick={irAPedidos} sx={{ fontWeight: 700 }}>
            Ver pedidos
          </Button>
        )}
        sx={{ alignItems: 'center' }}
      >
        {count === 1 ? 'La cafetería armó un pedido' : `${count} pedidos de la cafetería sin tratar`}
      </Alert>
    </Snackbar>
  );
}
