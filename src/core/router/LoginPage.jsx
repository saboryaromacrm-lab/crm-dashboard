import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { appConfig } from '@core/config/app.config.js';

/**
 * Minimal login placeholder. Auth is mocked today (any submit succeeds), but the
 * flow — redirect-back-to-intended-route — is already correct, so wiring a real
 * backend only touches auth.service.js.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from ?? appConfig.routes.defaultAuthenticatedRoute;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await login({});
    navigate(from, { replace: true });
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: 380, maxWidth: '100%' }}>
        <CardContent>
          <Typography variant="h2" sx={{ mb: 0.5 }}>
            {appConfig.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Ingresá para continuar
          </Typography>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField label="Email" type="email" fullWidth defaultValue="admin@saboryaroma.local" />
              <TextField label="Contraseña" type="password" fullWidth defaultValue="demo" />
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
