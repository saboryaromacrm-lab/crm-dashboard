import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { appConfig } from '@core/config/app.config.js';
import { httpClient } from '@core/services/httpClient.js';
import { leerTokenTerminal } from '@core/auth/terminal.js';

/**
 * LOGIN — usuario + contraseña, y la sucursal SOLO si hace falta preguntarla.
 *
 * LA SUCURSAL LA PONE EL EQUIPO (0081). Si esta máquina está registrada como
 * terminal, acá no hay desplegable: se muestra "Caja 2 · Distribuidora" y
 * listo. La cajera elige quién es y su clave, nada más.
 *
 * Por qué importaba tanto: este campo venía **precargado con la primera
 * sucursal de la lista**, así que la que no lo tocaba entraba en la
 * Distribuidora sin haber decidido nada, y vendía descontando stock del local
 * equivocado. No lo detecta ni el cierre de caja. La solución no es avisar
 * mejor: es que no haya nada que elegir.
 *
 * SIN TERMINAL REGISTRADA el desplegable vuelve, pero **arranca vacío**: uno
 * precargado invita a no mirarlo, uno vacío obliga a elegir.
 *
 * Tras el login se recarga la página entera: los motores de los módulos leen
 * su contexto al arrancar, y así TODOS nacen como este usuario en esta sucursal.
 */
export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();

  const [usuarios, setUsuarios] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  /** `null` = todavía no se preguntó; `false` = este equipo no está registrado. */
  const [terminal, setTerminal] = useState(null);

  const from = location.state?.from ?? appConfig.routes.defaultAuthenticatedRoute;

  /*
   * QUIÉN ES ESTE EQUIPO. Se pregunta ANTES que nada: si está registrado, el
   * desplegable de sucursales no se dibuja. Por POST y no por `?token=` para
   * que el token no quede en los logs del proxy ni en el historial.
   *
   * Si falla (sin red, servidor caído) se sigue como equipo sin registrar: es
   * preferible pedir la sucursal a mano que dejar a la cajera sin poder entrar.
   */
  useEffect(() => {
    let vivo = true;
    const token = leerTokenTerminal();
    if (!token) { setTerminal(false); return undefined; }
    httpClient.post('/terminales/actual', { token })
      .then((r) => vivo && setTerminal(r?.terminal ?? false))
      .catch(() => vivo && setTerminal(false));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    /*
     * UN SOLO endpoint público, y devuelve lo justo para poder elegir.
     *
     * Antes esto pedía `/usuarios` y `/sucursales`, que ahora exigen sesión —
     * y no puede haberla todavía. Pero abrirlos habría sido peor que un
     * problema técnico: `/usuarios` trae los permisos de cada rol y quién es
     * superadmin, o sea el mapa de a quién conviene atacar, servido a
     * cualquiera que abra la URL. `/auth/opciones` devuelve **solo nombre e
     * id**: también se le sacó "si tiene contraseña definida", que era la lista
     * de por dónde empezar y que esta pantalla ni siquiera usaba.
     */
    httpClient.get('/auth/opciones')
      .then(({ usuarios: us, sucursales: sucs }) => {
        if (!vivo) return;
        setUsuarios(us);
        setSucursales(sucs);
        /* NO SE PRESELECCIONA NINGUNA. Acá había un `setSucursalId(sucs[0].id)`
         * que dejaba el campo en la primera de la lista —la Distribuidora— y
         * era el origen del problema: la cajera que no lo tocaba entraba ahí
         * sin haber elegido. Vacío obliga a mirar. */
      })
      .catch(() => vivo && setError('No se pudo conectar con la API. ¿Está levantada?'));
    return () => { vivo = false; };
  }, []);

  const usuario = useMemo(
    () => (usuarios ?? []).find((u) => u.id === Number(usuarioId)),
    [usuarios, usuarioId],
  );
  /* Con el equipo registrado la sucursal sale de la terminal; sin registrar,
   * del desplegable. Un solo lugar la resuelve para que la confirmación, la
   * validación y el envío no puedan discrepar entre sí. */
  const sucursal = useMemo(
    () => (terminal ? terminal.sucursal : sucursales.find((s) => s.id === Number(sucursalId))),
    [terminal, sucursales, sucursalId],
  );

  const continuar = (e) => {
    e?.preventDefault();
    setError('');
    if (!usuario) { setError('Elegí tu usuario.'); return; }
    if (!password) { setError('Ingresá tu contraseña.'); return; }
    if (!sucursal) { setError('Elegí la sucursal con la que vas a operar.'); return; }
    setConfirmando(true);
  };

  const entrar = async () => {
    setEntrando(true);
    setError('');
    try {
      /* El `sucursalId` viaja igual, pero cuando hay terminal **el servidor lo
       * ignora** y usa la del equipo: el candado vive allá, no acá. */
      await login({ usuarioId: usuario.id, password, sucursalId: sucursal.id });
      // Recarga completa a propósito: ver comentario de arriba.
      window.location.replace(from);
    } catch (e2) {
      setError(e2?.data?.message || 'No se pudo iniciar sesión.');
      setConfirmando(false);
      setEntrando(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: 400, maxWidth: '100%' }}>
        <CardContent sx={{ p: 3.5 }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>{appConfig.name}</Typography>

          {!confirmando ? (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Ingresá con tu usuario y elegí la sucursal donde vas a trabajar.
              </Typography>
              <form onSubmit={continuar}>
                <Stack spacing={2}>
                  <TextField
                    select fullWidth label="Usuario" value={usuarioId}
                    onChange={(e) => setUsuarioId(e.target.value)}
                    disabled={usuarios === null}
                  >
                    {/* Solo el nombre. `rolNombre` NO viaja en /auth/opciones —que es
                        público— y este renglón mostraba "Lucas — " con el guion colgando.
                        Agregarlo a la API para "arreglar" el guion publicaría quién es el
                        superadmin a cualquiera que abra la URL del login. */}
                    {(usuarios ?? []).map((u) => (
                      <MenuItem key={u.id} value={String(u.id)}>{u.nombre}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth type="password" label="Contraseña" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  {/*
                    EQUIPO REGISTRADO = NO HAY NADA QUE ELEGIR.
                    Se muestra dónde está parado y con qué nombre, para que se
                    note si alguna vez está mal — pero no se ofrece cambiarlo:
                    eso lo hace un jefe desde Sistema › Este equipo, y así el
                    cambio queda registrado en vez de pasar en el aire.
                  */}
                  {terminal ? (
                    <Stack
                      direction="row" spacing={1.5} alignItems="center"
                      sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}
                    >
                      <StorefrontIcon color="primary" />
                      <div>
                        <Typography variant="subtitle2">
                          {terminal.nombre} · {terminal.sucursal.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          La sucursal la pone este equipo
                        </Typography>
                      </div>
                    </Stack>
                  ) : (
                    <TextField
                      select fullWidth label="Sucursal donde vas a operar" value={sucursalId}
                      onChange={(e) => setSucursalId(e.target.value)}
                      helperText="Este equipo no está registrado: elegí a mano dónde estás."
                    >
                      {sucursales.map((s) => (
                        <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
                      ))}
                    </TextField>
                  )}
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large">Continuar</Button>
                </Stack>
              </form>
            </>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 2.5 }}>
                Confirmá antes de entrar — todo lo que hagas queda registrado a tu nombre y en esa sucursal.
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <PersonIcon color="primary" />
                  <div>
                    <Typography variant="subtitle2">{usuario?.nombre}</Typography>
                    {/* Antes acá iba el nombre del ROL. Se sacó a propósito: la
                        pantalla de login es pública, y "Lucas ·
                        Superadministrador" le dice a cualquiera a quién le
                        conviene adivinarle la contraseña. El rol aparece
                        adentro, cuando ya hay sesión. */}
                    <Typography variant="caption" color="text.secondary">
                      Todo lo que hagas queda registrado a este nombre
                    </Typography>
                  </div>
                </Stack>
                <Divider />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <StorefrontIcon color="primary" />
                  <div>
                    <Typography variant="subtitle2">{sucursal?.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {terminal
                        ? `Sucursal de este equipo (${terminal.nombre})`
                        : 'Sucursal de trabajo de esta sesión'}
                    </Typography>
                  </div>
                </Stack>
              </Stack>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Stack direction="row" spacing={1.5}>
                <Button fullWidth variant="outlined" onClick={() => setConfirmando(false)} disabled={entrando}>
                  Volver
                </Button>
                <Button fullWidth variant="contained" onClick={entrar} disabled={entrando}>
                  {entrando ? 'Entrando…' : 'Sí, entrar'}
                </Button>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
