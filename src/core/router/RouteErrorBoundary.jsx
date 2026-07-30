import { useRouteError, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { appConfig } from '@core/config/app.config.js';
import { logger } from '@core/services/logger.js';

/**
 * Catches errors thrown by loaders/actions/renders within the protected tree so
 * a single broken route never blanks the whole app.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  logger.error('Route error boundary caught:', error);

  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
      <Box>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Algo salió mal
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {error?.statusText || error?.message || 'Error inesperado.'}
        </Typography>
        <Button component={RouterLink} to={appConfig.routes.defaultAuthenticatedRoute} variant="contained">
          Volver al inicio
        </Button>
      </Box>
    </Box>
  );
}
