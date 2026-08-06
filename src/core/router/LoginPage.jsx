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

/**
 * LOGIN — usuario + contraseña + LA SUCURSAL con la que se va a operar.
 * La sucursal se elige acá porque es el contexto de TODA la sesión (qué stock
 * ves, desde dónde pedís mercadería, qué caja abrís). Antes de entrar hay un
 * paso de confirmación: entrar como otro usuario o parado en otra sucursal
 * deja historiales a nombre equivocado.
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

  const from = location.state?.from ?? appConfig.routes.defaultAuthenticatedRoute;

  useEffect(() => {
    let vivo = true;
    Promise.all([httpClient.get('/usuarios'), httpClient.get('/sucursales')])
      .then(([us, sucs]) => {
        if (!vivo) return;
        setUsuarios(us.filter((u) => u.activo));
        setSucursales(sucs);
        if (sucs.length) setSucursalId(String(sucs[0].id));
      })
      .catch(() => vivo && setError('No se pudo conectar con la API. ¿Está levantada?'));
    return () => { vivo = false; };
  }, []);

  const usuario = useMemo(
    () => (usuarios ?? []).find((u) => u.id === Number(usuarioId)),
    [usuarios, usuarioId],
  );
  const sucursal = useMemo(
    () => sucursales.find((s) => s.id === Number(sucursalId)),
    [sucursales, sucursalId],
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
                    {(usuarios ?? []).map((u) => (
                      <MenuItem key={u.id} value={String(u.id)}>
                        {u.nombre} — {u.rolNombre}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth type="password" label="Contraseña" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <TextField
                    select fullWidth label="Sucursal donde vas a operar" value={sucursalId}
                    onChange={(e) => setSucursalId(e.target.value)}
                  >
                    {sucursales.map((s) => (
                      <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
                    ))}
                  </TextField>
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
                    <Typography variant="caption" color="text.secondary">{usuario?.rolNombre}</Typography>
                  </div>
                </Stack>
                <Divider />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <StorefrontIcon color="primary" />
                  <div>
                    <Typography variant="subtitle2">{sucursal?.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">Sucursal de trabajo de esta sesión</Typography>
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
