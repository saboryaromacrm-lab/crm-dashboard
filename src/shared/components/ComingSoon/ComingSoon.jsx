import { Paper, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { PageHeader } from '@shared/components/PageHeader/PageHeader.jsx';

/**
 * Placeholder reutilizable para módulos que todavía no se implementaron.
 * Mantiene la cabecera estándar del CRM y una tarjeta "Próximamente".
 *
 * @param {{ title: string, subtitle?: string, note?: string }} props
 */
export function ComingSoon({ title, subtitle, note }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          textAlign: 'center',
          py: 10,
          px: 3,
          borderRadius: 3,
          borderStyle: 'dashed',
        }}
      >
        <ConstructionIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h6">Próximamente</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 460 }}>
          {note || `El módulo ${title} está en construcción. Lo vamos a trabajar más adelante.`}
        </Typography>
      </Paper>
    </div>
  );
}
