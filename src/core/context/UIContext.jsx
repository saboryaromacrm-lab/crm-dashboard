import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { appConfig } from '@core/config/app.config.js';

const UIContext = createContext(null);

/**
 * Global, cross-cutting UI state that the layout needs but no single module
 * owns: sidebar collapsed/open state and the mobile drawer.
 *
 * Kept separate from theme and auth so each concern stays small and testable
 * (Single Responsibility). Modules never need this — it's layout plumbing.
 */
export function UIProvider({ children }) {
  // Desktop: sidebar can be collapsed to icons.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    appConfig.layout.sidebarDefaultCollapsed,
  );
  // Mobile: off-canvas drawer open/closed.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = useCallback(
    () => setSidebarCollapsed((v) => !v),
    [],
  );
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
    }),
    [
      sidebarCollapsed,
      toggleSidebar,
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within <UIProvider>');
  return ctx;
}
