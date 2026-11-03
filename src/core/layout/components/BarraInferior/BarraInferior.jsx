import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import CircleIcon from '@mui/icons-material/Circle';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { useNavigation } from '@core/navigation/useNavigation.js';
import { useUI } from '@core/context/UIContext.jsx';
import { cx } from '@shared/utils/classNames.js';
import styles from './BarraInferior.module.css';

/**
 * LA BARRA DE ABAJO DEL TELÉFONO (3/11/2026, pedido del dueño: «que quede
 * súper utilizable en el celular»).
 * ============================================================================
 * En el teléfono el menú de la izquierda se abría con la hamburguesa de arriba
 * a la izquierda: el lugar más lejos del pulgar. Abajo quedan, a un toque:
 *   · Inicio,
 *   · los tres módulos que más se usan de los que tiene el usuario (con su
 *     número de pendientes, como en el menú),
 *   · «Menú», que abre el menú completo.
 * Sale de la misma navegación que el menú (registro + permisos): un módulo que
 * el rol no ve tampoco aparece acá.
 */
const PREFERIDOS = ['gerencia', 'proveedores', 'almacen', 'ventas', 'compras', 'gastos', 'web', 'sistema'];
const INICIO = 'dashboard';

export function BarraInferior() {
  const grupos = useNavigation();
  const { openMobileNav, mobileNavOpen } = useUI();

  const items = useMemo(() => {
    const todos = grupos.flatMap((g) => g.items);
    const inicio = todos.find((i) => i.id === INICIO);
    const modulos = PREFERIDOS.map((id) => todos.find((i) => i.id === id)).filter(Boolean).slice(0, inicio ? 3 : 4);
    return [inicio, ...modulos].filter(Boolean);
  }, [grupos]);

  return (
    <nav className={styles.barra} aria-label="Accesos rápidos">
      {items.map((item) => {
        const Icon = item.icon ?? CircleIcon;
        return (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => cx(styles.item, isActive && styles.activo)}
          >
            <span className={styles.icono}>
              <Icon />
              {item.badgeCount > 0 && <span className={styles.badge}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</span>}
            </span>
            <span className={styles.texto}>{item.id === INICIO ? 'Inicio' : item.label}</span>
          </NavLink>
        );
      })}
      <button
        type="button"
        className={cx(styles.item, mobileNavOpen && styles.activo)}
        onClick={openMobileNav}
        aria-label="Abrir el menú completo"
      >
        <span className={styles.icono}><MenuRoundedIcon /></span>
        <span className={styles.texto}>Menú</span>
      </button>
    </nav>
  );
}
