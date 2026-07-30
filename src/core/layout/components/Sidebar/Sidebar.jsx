import { SidebarContent } from './SidebarContent.jsx';
import { useUI } from '@core/context/UIContext.jsx';

/**
 * Desktop persistent sidebar. Reads collapsed state from the UI context; the
 * collapse toggle itself lives in the Topbar so it's reachable in every state.
 */
export function Sidebar() {
  const { sidebarCollapsed } = useUI();
  return <SidebarContent collapsed={sidebarCollapsed} />;
}
