import {
  Card,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { formatCurrency, formatRelativeTime } from '@shared/utils/formatters.js';
import styles from '../styles/Dashboard.module.css';

const STATUS_COLOR = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

/**
 * Recent activity table. On desktop it's a full table; on narrow screens it
 * scrolls horizontally (TableContainer) so columns never squash — a simple,
 * robust responsive strategy for tabular data.
 */
export function RecentActivityTable({ rows, loading }) {
  return (
    <Card className={styles.activityCard}>
      <div className={styles.activityHeader}>
        <Typography variant="h3">Actividad reciente</Typography>
        <Typography variant="body2" color="text.secondary">
          Últimos movimientos del comercio
        </Typography>
      </div>

      <TableContainer className="crm-scroll-area">
        <Table sx={{ minWidth: 640 }} aria-label="Actividad reciente">
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell align="right">Cuándo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.type}
                        color={STATUS_COLOR[row.status] ?? 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.user}</TableCell>
                    <TableCell align="right">
                      {row.amount == null ? '—' : formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell align="right">{formatRelativeTime(row.at)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
