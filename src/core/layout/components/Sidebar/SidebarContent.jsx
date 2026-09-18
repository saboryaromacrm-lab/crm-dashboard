import { NavLink } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { useNavigation } from '@core/navigation/useNavigation.js';
import { appConfig } from '@core/config/app.config.js';
import { cx } from '@shared/utils/classNames.js';
import { FirmaCoftech } from '@core/branding/FirmaCoftech.jsx';
import { LogoSya } from '@core/branding/LogoSya.jsx';
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
      {/*
        EL LOGO, SIN CAJA. Antes acá había un cuadrado con degradado y las
        letras "SA" adentro: esa caja existía porque dos letras sueltas no se
        leen como una marca. Con el logo de verdad sobra — y el degradado, que
        metía dos colores más, le peleaba al verde del menú. La versión blanca
        apoya directo sobre el fondo oscuro, que es para lo que está hecha.

        `decorativo`: el nombre del sistema está escrito al lado, y un lector
        de pantalla que anuncie las dos cosas diría la marca dos veces.
      */}
      <div className={styles.brand}>
        <LogoSya variante="blanco" decorativo />
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
                    {!collapsed && item.badgeCount > 0 && (
                      <span className={styles.navBadge}>{item.badgeCount}</span>
                    )}
                  </NavLink>
                );
                const tooltipTitle = item.badgeCount > 0
                  ? `${item.label} (${item.badgeCount} pendiente${item.badgeCount === 1 ? '' : 's'})`
                  : item.label;

                return (
                  <li key={item.id}>
                    {collapsed ? (
                      <Tooltip title={tooltipTitle} placement="right">
                        <span style={{ position: 'relative', display: 'block' }}>
                          {link}
                          {item.badgeCount > 0 && <span className={styles.navBadgeDot} />}
                        </span>
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
        <>
          <div className={styles.footer}>
            <span className={styles.version}>v{appConfig.version}</span>
          </div>
          {/* Fuera del pie a propósito: la franja va de borde a borde del
              sidebar, y `.footer` tiene padding propio. */}
          <FirmaCoftech />
        </>
      )}
    </nav>
  );
}
