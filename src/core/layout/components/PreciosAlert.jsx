/**
 * ALERTA DE CAMBIO DE PRECIOS — el aviso al cajero, en cualquier pantalla
 * ============================================================================
 * Cuando alguien actualiza precios, todos los cajeros con el CRM abierto tienen
 * los precios viejos en memoria. Este aviso se los dice y les da el botón para
 * traer los nuevos de una.
 *
 * Ojo con la asimetría respecto del aviso de pedidos web: ese va PARA la
 * administración; este va para el CAJERO, porque es el que tiene precios viejos
 * en pantalla.
 *
 * El resto de las decisiones son las del aviso de pedidos, por las mismas razones:
 *  - El primer tick NO alerta: al abrir el CRM el catálogo ya está fresco. La
 *    alerta es para lo que cambia MIENTRAS estás trabajando.
 *  - Solo lo ve quien tiene el punto de venta: al que no cobra no le cambia nada.
 *  - Tampoco lo ve QUIEN hizo el cambio — ya lo sabe.
 *  - No se auto-esconde: un precio viejo cuesta plata en cada venta, así que el
 *    cartel se queda hasta que el cajero actualice o lo cierre a mano.
 *  - El sonido es sintetizado (WebAudio): sin archivos, y si el navegador no
 *    deja sonar, el aviso visual alcanza.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { usePermissions } from '@core/permissions/PermissionContext.jsx';
import { leerSesion } from '@core/auth/sesion.js';
import { cambiosPrecio, pedirRecargaDePrecios } from '@core/services/cambiosPrecio.js';

/** Dos notas descendentes: distinto del de pedidos, que sube. Se distinguen a ciegas. */
function aviso() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const nota = (freq, t0, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t0);
      osc.stop(ctx.currentTime + t0 + dur + 0.05);
    };
    nota(1046.5, 0, 0.24);  // Do6
    nota(783.99, 0.15, 0.3); // Sol5
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sin audio disponible: el aviso visual alcanza */ }
}

/** Id del usuario de la sesión: para no avisarle a quien hizo el cambio. */
function usuarioDeSesion() {
  return leerSesion()?.usuario?.id ?? null;
}

export function PreciosAlert() {
  const { can } = usePermissions();
  const { ultimo, hayNovedad } = useSyncExternalStore(
    cambiosPrecio.subscribe, cambiosPrecio.estado, cambiosPrecio.estado,
  );

  /*
   * EL ÚNICO CAMBIO QUE NO SE AVISA ES EL PROPIO — y se da por VISTO en
   * silencio, para que no quede pendiente para siempre tapando al siguiente.
   *
   * Antes había un segundo filtro: avisar solo si el autor era `admin` o
   * `superadmin`. Se fue (23/9/2026) porque no protegía de nada y sí podía
   * romper: mover un precio ya exige el permiso `precios`, así que quien llega
   * al historial es por definición alguien que puede: comparar además contra
   * dos nombres de rol escritos a mano solo agregaba la forma de apagar el
   * cartel sin que nadie se entere el día que exista un rol nuevo con esa llave.
   */
  const yo = useRef(usuarioDeSesion());
  const propio = ultimo?.usuarioId != null && ultimo.usuarioId === yo.current;
  const paraElCajero = hayNovedad && !propio;
  const aDescartar = hayNovedad && !paraElCajero;
  useEffect(() => { if (aDescartar) cambiosPrecio.marcarVisto(); }, [aDescartar]);

  const visible = paraElCajero && can('ventas.pos');
  useEffect(() => { if (visible) aviso(); }, [visible]);

  if (!visible) return null;

  const n = ultimo?.productos ?? 0;
  const quien = ultimo?.usuarioNombre ? `${ultimo.usuarioNombre} ` : '';
  const texto = n > 1
    ? `${quien}actualizó los precios de ${n} productos`
    : `${quien}actualizó un precio`;

  return (
    <Snackbar open anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
      <Alert
        severity="warning"
        variant="filled"
        icon={<span style={{ fontSize: 18 }}>🏷️</span>}
        // Cerrar es "ya lo sé": el cartel no vuelve hasta el próximo cambio.
        onClose={() => cambiosPrecio.marcarVisto()}
        action={(
          <Button color="inherit" size="small" onClick={pedirRecargaDePrecios} sx={{ fontWeight: 700 }}>
            Actualizar precios
          </Button>
        )}
        sx={{ alignItems: 'center' }}
      >
        {texto}
        {ultimo?.detalle ? ` · ${ultimo.detalle}` : ''}
      </Alert>
    </Snackbar>
  );
}
