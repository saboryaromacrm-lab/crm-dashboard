import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { appConfig } from '@core/config/app.config.js';

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Box>
        <Typography variant="h1" sx={{ fontSize: '4rem', fontWeight: 800 }}>
          404
        </Typography>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Página no encontrada
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          La ruta que buscás no existe o fue movida.
        </Typography>
        <Button
          component={RouterLink}
          to={appConfig.routes.defaultAuthenticatedRoute}
          variant="contained"
        >
          Volver al inicio
        </Button>
      </Box>
    </Box>
  );
}
