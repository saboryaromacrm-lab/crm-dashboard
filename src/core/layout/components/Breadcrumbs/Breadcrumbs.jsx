import { Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useBreadcrumbs } from '@core/navigation/useBreadcrumbs.js';
import styles from './Breadcrumbs.module.css';

/**
 * Breadcrumb trail derived from the active route (see useBreadcrumbs). Uses MUI
 * for the component; the data comes from the router so it stays in sync with
 * navigation automatically.
 */
export function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  if (crumbs.length <= 1) return null;

  return (
    <div className={styles.wrapper}>
      <MuiBreadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
        {crumbs.map((crumb) =>
          crumb.isLast ? (
            <Typography key={crumb.to} color="text.primary" fontWeight={600}>
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.to}
              component={RouterLink}
              to={crumb.to}
              underline="hover"
              color="text.secondary"
            >
              {crumb.label}
            </Link>
          ),
        )}
      </MuiBreadcrumbs>
    </div>
  );
}
