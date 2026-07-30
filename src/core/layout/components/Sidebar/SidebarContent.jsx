import { NavLink } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { useNavigation } from '@core/navigation/useNavigation.js';
import { appConfig } from '@core/config/app.config.js';
import { cx } from '@shared/utils/classNames.js';
import styles from './Sidebar.module.css';

/**
 * The actual navigation content, shared by the desktop sidebar and the mobile
 * drawer so there is exactly one implementation of the nav list.
 *
 * Items come from `useNavigation()` (registry + permissions). This component
 * renders links; it never knows which modules exist.
 *
 * @param {{ collapsed?: boolean, onNavigate?: () => void }} props
 */
export function SidebarContent({ collapsed = false, onNavigate }) {
  const groups = useNavigation();

  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      <div className={styles.brand}>
        <span className={styles.brandMark}>SA</span>
        {!collapsed && <span className={styles.brandName}>{appConfig.name}</span>}
      </div>

      <div className={cx(styles.navScroll, 'crm-scroll-area')}>
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            {!collapsed && <p className={styles.groupLabel}>{group.label}</p>}
            <ul role="list" className={styles.navList}>
              {group.items.map((item) => {
                const Icon = item.icon ?? CircleIcon;
                const link = (
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(styles.navItem, isActive && styles.navItemActive)
                    }
                  >
                    <span className={styles.navIcon}>
                      <Icon fontSize="small" />
                    </span>
                    {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                  </NavLink>
                );

                return (
                  <li key={item.id}>
                    {collapsed ? (
                      <Tooltip title={item.label} placement="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className={styles.footer}>
          <span className={styles.version}>v{appConfig.version}</span>
        </div>
      )}
    </nav>
  );
}
