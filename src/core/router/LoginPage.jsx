import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Divider, MenuItem, Stack, TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { appConfig } from '@core/config/app.config.js';
import { MarcaCoftech } from '@core/branding/FirmaCoftech.jsx';
import { LogoSya } from '@core/branding/LogoSya.jsx';
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
  const campoUsuario = useRef(null);

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

  /*
   * SOLO LAS SUCURSALES DONDE TRABAJA (0105). Lista vacía = todas. Si tiene una
   * sola, se elige sola: no hay nada que decidir, y es justo el caso del
   * fraccionador en el Depósito. Si la elegida no es suya, se limpia — el
   * servidor la rechazaría igual, pero es mejor no ofrecerla.
   */
  const sucursalesDelUsuario = useMemo(() => {
    const suyas = usuario?.sucursales ?? [];
    return suyas.length ? sucursales.filter((x) => suyas.includes(x.id)) : sucursales;
  }, [usuario, sucursales]);
  useEffect(() => {
    if (!usuario) return;
    if (sucursalesDelUsuario.length === 1 && (usuario.sucursales ?? []).length) {
      setSucursalId(String(sucursalesDelUsuario[0].id));
    } else if (sucursalId && !sucursalesDelUsuario.some((x) => x.id === Number(sucursalId))) {
      setSucursalId('');
    }
  }, [usuario, sucursalesDelUsuario]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Con el equipo registrado la sucursal sale de la terminal; sin registrar,
   * del desplegable. Un solo lugar la resuelve para que la confirmación, la
   * validación y el envío no puedan discrepar entre sí.
   *
   * EL CAMPO VACÍO ES "SIN ESPECIFICAR" (27/8, pedido del dueño: la opción
   * explícita del desplegable se fue). Vacío viaja SIN sucursal y el servidor
   * decide — el superadmin entra así sin tocar nada (queda parado en la
   * central y la cambia arriba); a cualquier otro rol lo rechaza pidiéndole
   * que la elija. La pantalla no puede decidirlo acá porque el login público
   * no sabe quién es superadmin, y publicarlo sería regalar a quién atacar —
   * por eso el default es "vacío que el servidor juzga" y no "campo que
   * desaparece para el superadmin". */
  /*
   * HAY PUESTOS QUE NO ESTÁN EN NINGUNA SUCURSAL (0098) — hoy, la cafetería:
   * no está adentro de un local, habla CON los locales. A esa persona no se le
   * pregunta nada, ni siquiera con el equipo registrado: elegir una sería
   * inventar un dato, y después ese dato se cuela en lo que graba.
   *
   * `pideSucursal` viene por usuario desde `/auth/opciones` y es lo ÚNICO que
   * ese endpoint público suma: no dice qué rol es ni qué puede hacer. Y es una
   * comodidad de la pantalla, no el candado — el servidor decide igual por el
   * rol, así que mandar una sucursal a mano desde afuera no cambia nada.
   */
  const noVaSucursal = usuario ? usuario.pideSucursal === false : false;
  const sinSucursal = !noVaSucursal && !terminal && !sucursalId;
  const sucursal = useMemo(
    () => {
      if (noVaSucursal) return { id: null, nombre: '' };
      if (terminal) return terminal.sucursal;
      if (!sucursalId) return { id: null, nombre: 'Sin especificar' };
      return sucursales.find((s) => s.id === Number(sucursalId));
    },
    [noVaSucursal, terminal, sucursales, sucursalId],
  );

  /*
   * EL CURSOR ARRANCA EN "USUARIO", pero recién cuando se puede escribir.
   *
   * El `autoFocus` del campo no alcanzaba y el motivo no es obvio: mientras la
   * lista de usuarios no llegó, el campo está DESHABILITADO, y un campo
   * deshabilitado no toma foco. Para cuando se habilitaba, el momento del
   * `autoFocus` —que es el montaje— ya había pasado, así que la pantalla abría
   * con el foco en ningún lado y había que ir al mouse igual.
   *
   * Solo si no hay usuario elegido: quien volvió desde la confirmación ya
   * eligió, y robarle el foco lo mandaría a empezar de nuevo.
   */
  useEffect(() => {
    if (usuarios && !usuarioId) campoUsuario.current?.focus();
  }, [usuarios, usuarioId]);

  const continuar = (e) => {
    e?.preventDefault();
    setError('');
    if (!usuario) { setError('Elegí tu usuario.'); return; }
    if (!password) { setError('Ingresá tu contraseña.'); return; }
    /* La sucursal vacía NO corta acá: sigue viaje sin sucursal y el servidor
     * decide (superadmin sí, el resto no). El corte del lado de la pantalla
     * mentiría para el único que puede entrar así. */
    setConfirmando(true);
  };

  const entrar = async () => {
    setEntrando(true);
    setError('');
    try {
      /* El `sucursalId` viaja igual, pero cuando hay terminal **el servidor lo
       * ignora** y usa la del equipo: el candado vive allá, no acá. Con "No
       * especificar" directamente no viaja, y el servidor decide si puede. */
      await login({ usuarioId: usuario.id, password, sucursalId: sucursal.id ?? undefined });
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
          {/*
            EL LOGO ARRIBA, y el nombre debajo: es el orden en que se lee una
            portada. Al costado del título competiría por el ancho y obligaría
            a achicar uno de los dos; arriba, centrado y con aire, la marca se
            ve entera y el texto queda donde el ojo ya lo busca.
          */}
          <LogoSya decorativo />

          {/*
            EL NOMBRE Y LA FIRMA, en dos pesos. El nombre del sistema manda; la
            firma va al lado, chica y alineada a la MISMA BASE — no centrada,
            que la dejaría flotando. `baseline` es lo que hace que se lea como
            una sola línea y no como dos cosas apiladas.
          */}
          <Typography
            variant="h2"
            sx={{
              mb: 0.5, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
              columnGap: 1, justifyContent: 'center', textAlign: 'center',
            }}
          >
            {appConfig.name}
            <MarcaCoftech />
          </Typography>

          {!confirmando ? (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Ingresá con tu usuario y elegí la sucursal donde vas a trabajar.
              </Typography>
              <form onSubmit={continuar}>
                <Stack spacing={2}>
                  {/*
                    SE ESCRIBE, NO SE BUSCA EN LA LISTA (18/9/2026, pedido del
                    dueño). Era un desplegable: con el equipo creciendo, entrar
                    significaba abrirlo y recorrerlo con la vista hasta
                    encontrarse. Ahora se tipean dos letras y queda uno solo.

                    El foco inicial + `autoHighlight` es lo que lo vuelve un gesto
                    de teclado y no de mouse: la pantalla abre con el cursor
                    acá, se tipea, y el Enter toma el resaltado. Con la lista
                    cerrada ese mismo Enter no elige nada y cae en el `submit`
                    del formulario, que es justo lo que se quiere al final.

                    Solo el nombre. `rolNombre` NO viaja en /auth/opciones —que
                    es público— y agregarlo publicaría quién es el superadmin a
                    cualquiera que abra la URL del login.
                  */}
                  <Autocomplete
                    options={usuarios ?? []}
                    value={usuario ?? null}
                    onChange={(_, elegido) => setUsuarioId(elegido ? String(elegido.id) : '')}
                    getOptionLabel={(u) => u?.nombre ?? ''}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    disabled={usuarios === null}
                    autoHighlight
                    openOnFocus
                    noOptionsText="Ningún usuario con ese nombre"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Usuario"
                        placeholder="Escribí tu nombre…"
                        inputRef={campoUsuario}
                        inputProps={{ ...params.inputProps, autoComplete: 'off' }}
                      />
                    )}
                  />
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
                  {noVaSucursal ? (
                    /* Ni desplegable ni cartel de equipo: este puesto trabaja
                       fuera de las sucursales y la pregunta no aplica. */
                    <Stack
                      direction="row" spacing={1.5} alignItems="center"
                      sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}
                    >
                      <StorefrontIcon color="primary" />
                      <div>
                        <Typography variant="subtitle2">No trabajás en una sucursal</Typography>
                        <Typography variant="caption" color="text.secondary">
                          La sucursal la elegís en cada envío y en cada pedido
                        </Typography>
                      </div>
                    </Stack>
                  ) : terminal ? (
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
                      {/* Sin opción "No especificar" (27/8): dejar el campo
                          VACÍO ya es eso — el superadmin entra directo y al
                          resto el servidor le pide elegirla. Una opción que
                          solo sirve a uno era ruido para todos los demás. */}
                      {sucursalesDelUsuario.map((s) => (
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
            /*
              EL ENTER LLEGA HASTA EL FINAL (18/9/2026, pedido del dueño).
              Esta pantalla no era un formulario: se llegaba con Enter desde la
              anterior y acá había que soltar el teclado y buscar el mouse, en
              la pantalla que la cajera abre cada vez que empieza un turno.
              Ahora es un `form` con su botón `submit` enfocado, así que Enter
              entra — sin inventar atajos: es el comportamiento que el
              navegador ya le da a cualquier formulario.

              La CONFIRMACIÓN NO SE SALTEA. Es un paso de una tecla, no un
              estorbo: lo que viene después queda registrado a nombre de quien
              entró y en esa sucursal, y esa es exactamente la clase de cosa
              que conviene mirar una vez antes de que pase.
            */
            <form onSubmit={(e) => { e.preventDefault(); entrar(); }}>
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
                    <Typography variant="subtitle2">
                      {noVaSucursal ? 'Sin sucursal' : sucursal?.nombre}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {/* Vacío llega acá también la cajera que se olvidó de
                          elegir: el texto tiene que servirle a los dos — al
                          superadmin le cuenta qué pasa, a ella la manda de
                          vuelta al campo antes de que el servidor la rechace. */}
                      {noVaSucursal
                        ? 'Este puesto trabaja fuera de las sucursales'
                        : terminal
                          ? `Sucursal de este equipo (${terminal.nombre})`
                          : sinSucursal
                            ? 'Así entra solo el superadmin (parado en la central); si no lo sos, volvé y elegí la sucursal'
                            : 'Sucursal de trabajo de esta sesión'}
                    </Typography>
                  </div>
                </Stack>
              </Stack>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Stack direction="row" spacing={1.5}>
                {/* `type="button"`: sin eso, Volver también dispararía el
                    submit del formulario y entraría en vez de volver. */}
                <Button
                  type="button" fullWidth variant="outlined"
                  onClick={() => setConfirmando(false)} disabled={entrando}
                >
                  Volver
                </Button>
                <Button type="submit" fullWidth variant="contained" disabled={entrando} autoFocus>
                  {entrando ? 'Entrando…' : 'Sí, entrar'}
                </Button>
              </Stack>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
