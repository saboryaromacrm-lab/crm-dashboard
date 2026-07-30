import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Centered full-viewport loading indicator used during auth resolution and
 * lazy route loading.
 */
export function FullScreenLoader({ label }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
      {label ? (
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
      ) : null}
    </Box>
  );
}
