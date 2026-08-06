import { useEffect, useState } from 'react';
import {
  Avatar,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { httpClient } from '@core/services/httpClient.js';
import { leerSesion, actualizarSesion, actualizarCtx } from '@core/auth/sesion.js';
import { useUI } from '@core/context/UIContext.jsx';
import { useAuth } from '@core/auth/AuthContext.jsx';
import { useThemeMode } from '@core/theme/ThemeModeContext.jsx';
import { useBreakpoint } from '@core/hooks/useBreakpoint.js';
import { GlobalSearch } from './GlobalSearch.jsx';
import styles from './Topbar.module.css';

/**
 * Application header. Adapts to the viewport:
 *   - mobile/tablet: hamburger opens the nav drawer
 *   - desktop: button collapses/expands the fixed sidebar
 * Always exposes global search, theme toggle, notifications and the user menu.
 */
export function Topbar() {
  const { toggleSidebar, toggleMobileNav, sidebarCollapsed } = useUI();
  const { isDesktop } = useBreakpoint();
  const { mode, toggleThemeMode } = useThemeMode();
  const { user, logout } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  /**
   * Admin y superadmin pueden pararse en otra sucursal para supervisarla. Vive
   * acá, junto al dato de la sesión, en vez de repetir una barra en cada
   * pantalla. Las sucursales se piden al abrir el menú, no al cargar la app.
   */
  const esJefe = (user?.roles ?? []).some((r) => r === 'admin' || r === 'superadmin');
  useEffect(() => {
    if (!anchorEl || !esJefe || sucursales.length) return;
    httpClient.get('/sucursales').then(setSucursales).catch(() => setSucursales([]));
  }, [anchorEl, esJefe, sucursales.length]);

  const cambiarSucursal = (suc) => {
    // Se reescribe la sesión y el contexto de los módulos DE ESTA PESTAÑA y se
    // recarga: los motores leen su contexto al arrancar, así todo queda parado
    // en la nueva. Otras ventanas logueadas no se enteran — cada una tiene su
    // propia sesión (ver core/auth/sesion.js).
    const sesion = leerSesion();
    if (!sesion) return;
    sesion.sucursal = { id: suc.id, nombre: suc.nombre };
    actualizarSesion(sesion);
    actualizarCtx({ sucursalId: suc.id, usuarioId: sesion.usuario.id }, sesion.usuario.id);
    window.location.reload();
  };

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        <IconButton
          onClick={isDesktop ? toggleSidebar : toggleMobileNav}
          aria-label={isDesktop ? 'Contraer menú' : 'Abrir menú'}
          edge="start"
        >
          {isDesktop && !sidebarCollapsed ? <MenuOpenIcon /> : <MenuIcon />}
        </IconButton>
        <div className={styles.search}>
          <GlobalSearch />
        </div>
      </div>

      <div className={styles.right}>
        <Tooltip title={mode === 'light' ? 'Modo oscuro' : 'Modo claro'}>
          <IconButton onClick={toggleThemeMode} aria-label="Cambiar tema">
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Notificaciones">
          <IconButton aria-label="Notificaciones">
            <NotificationsNoneIcon />
          </IconButton>
        </Tooltip>

        {/* Quién sos y DÓNDE estás parado: la sucursal se eligió en el login
            y es el contexto de toda la sesión — tiene que estar a la vista. */}
        <div className={styles.userInfo}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>{user?.name ?? ''}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {user?.sucursalNombre ?? ''}
          </Typography>
        </div>

        <Tooltip title="Cuenta">
          <IconButton onClick={openMenu} aria-label="Menú de usuario" sx={{ ml: 0.5 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
              {getInitials(user?.name)}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
          <div className={styles.menuHeader}>
            <Typography variant="subtitle2">{user?.name ?? 'Invitado'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.rolNombre ?? ''}{user?.sucursalNombre ? ` · ${user.sucursalNombre}` : ''}
            </Typography>
          </div>
          <Divider />
          {esJefe && sucursales.length > 1 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
                Cambiar de sucursal
              </Typography>
              {sucursales.map((suc) => (
                <MenuItem
                  key={suc.id}
                  selected={suc.id === user?.sucursalId}
                  onClick={() => { closeMenu(); if (suc.id !== user?.sucursalId) cambiarSucursal(suc); }}
                >
                  <ListItemIcon>
                    <StorefrontIcon fontSize="small" />
                  </ListItemIcon>
                  {suc.nombre}
                </MenuItem>
              ))}
              <Divider />
            </>
          )}
          <MenuItem onClick={closeMenu}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            Mi perfil
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu();
              logout();
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Cerrar sesión
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}
