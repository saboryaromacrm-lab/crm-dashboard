import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { Topbar } from './components/Topbar/Topbar.jsx';
import { Breadcrumbs } from './components/Breadcrumbs/Breadcrumbs.jsx';
import { MobileNavDrawer } from './components/Sidebar/MobileNavDrawer.jsx';
import { useUI } from '@core/context/UIContext.jsx';
import { useBreakpoint } from '@core/hooks/useBreakpoint.js';
import { cx } from '@shared/utils/classNames.js';
import styles from './MainLayout.module.css';

/**
 * MAIN LAYOUT (application shell)
 * ============================================================================
 * Mobile-first, responsive shell composed of three regions:
 *   - Sidebar   (fixed on desktop, off-canvas drawer on mobile/tablet)
 *   - Topbar    (header with hamburger, breadcrumbs trigger, user menu)
 *   - Content   (breadcrumbs + routed module page via <Outlet/>)
 *
 * The layout owns NO business logic. Pages are injected by the router; the
 * sidebar is generated from the module registry. This file rarely changes.
 */
export function MainLayout() {
  const { sidebarCollapsed } = useUI();
  const { isDesktop } = useBreakpoint();

  return (
    <div
      className={cx(
        styles.layout,
        isDesktop && sidebarCollapsed && styles.collapsed,
        !isDesktop && styles.mobile,
      )}
    >
      {/* Desktop / tablet persistent sidebar */}
      {isDesktop && (
        <aside className={styles.sidebar}>
          <Sidebar />
        </aside>
      )}

      {/* Mobile / tablet off-canvas drawer */}
      {!isDesktop && <MobileNavDrawer />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <Topbar />
        </header>

        <main className={styles.content} id="main-content">
          <div className={styles.contentInner}>
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
