/**
 * ALERTA DE PEDIDOS WEB — el aviso vivo, en cualquier pantalla del CRM
 * ============================================================================
 * Escucha el poller de órdenes y, cuando el contador SUBE (entró un pedido
 * nuevo mientras el sistema está abierto), muestra un aviso chico arriba al
 * centro con una campanita de dos notas. Si entran varios juntos, es UN solo
 * aviso con el contador — no una pila de carteles.
 *
 * Decisiones deliberadas:
 *  - El primer tick NO alerta: lo que ya estaba pendiente al abrir el CRM se
 *    ve en los badges; la alerta es para lo que ENTRA ahora.
 *  - Solo lo ve la ADMINISTRACIÓN. Los pedidos del sitio los revisa y acepta el
 *    administrador; el cajero no maneja esa parte, así que un cartel cada vez
 *    que entra uno solo lo interrumpe en el mostrador. Además se exige la
 *    sección: si a un admin se le quitó Órdenes web, tampoco tiene sentido
 *    avisarle de algo que no puede abrir.
 *  - El sonido es sintetizado (WebAudio): sin archivos, y si el navegador no
 *    deja sonar (falta un gesto del usuario), el aviso visual alcanza.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { ordenesWeb } from '@core/services/ordenesWeb.js';

function campanita() {
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
    nota(880, 0, 0.28);        // La5
    nota(1174.66, 0.16, 0.34); // Re6 — dos notas ascendentes, corto y amable
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sin audio disponible: el aviso visual alcanza */ }
}

export function OrdenesWebAlert() {
  const { can, esAdmin } = usePermissions();
  const navigate = useNavigate();
  const count = useSyncExternalStore(ordenesWeb.subscribe, ordenesWeb.count, ordenesWeb.count);
  const [abierto, setAbierto] = useState(false);
  const previo = useRef(null);

  useEffect(() => {
    if (previo.current === null) { previo.current = count; return; }
    if (count > previo.current) {
      setAbierto(true);
      campanita();
    }
    previo.current = count;
  }, [count]);

  if (!esAdmin || !can('ventas.ordenes')) return null;

  const irAOrdenes = () => {
    setAbierto(false);
    navigate('/ventas?panel=ordenes');
  };

  return (
    <Snackbar
      open={abierto && count > 0}
      autoHideDuration={10000}
      onClose={(e, reason) => { if (reason !== 'clickaway') setAbierto(false); }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="filled"
        icon={<span style={{ fontSize: 18 }}>🛒</span>}
        onClose={() => setAbierto(false)}
        action={(
          <Button color="inherit" size="small" onClick={irAOrdenes} sx={{ fontWeight: 700 }}>
            Ver órdenes
          </Button>
        )}
        sx={{ alignItems: 'center' }}
      >
        {count === 1 ? 'Nuevo pedido del sitio web' : `${count} pedidos web sin revisar`}
      </Alert>
    </Snackbar>
  );
}
