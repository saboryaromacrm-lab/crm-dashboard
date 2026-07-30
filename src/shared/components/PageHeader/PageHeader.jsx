import { Typography } from '@mui/material';
import { useDocumentTitle } from '@core/hooks/useDocumentTitle.js';
import styles from './PageHeader.module.css';

/**
 * Standard page header used by every module page for a consistent look:
 * title, optional subtitle, and an actions slot (buttons, filters).
 * Also sets the document title as a side effect.
 *
 * @param {{ title: string, subtitle?: string, actions?: React.ReactNode }} props
 */
export function PageHeader({ title, subtitle, actions }) {
  useDocumentTitle(title);
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <Typography variant="h2" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" className={styles.subtitle}>
            {subtitle}
          </Typography>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
