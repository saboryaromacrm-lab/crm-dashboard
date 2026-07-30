import { Drawer } from '@mui/material';
import { SidebarContent } from './SidebarContent.jsx';
import { useUI } from '@core/context/UIContext.jsx';

/**
 * Off-canvas navigation for mobile/tablet. Uses MUI's Drawer (temporary) for
 * accessible focus-trapping and backdrop; the inner content is the SAME
 * SidebarContent used on desktop, so navigation stays DRY.
 */
export function MobileNavDrawer() {
  const { mobileNavOpen, closeMobileNav } = useUI();

  return (
    <Drawer
      anchor="left"
      open={mobileNavOpen}
      onClose={closeMobileNav}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: 'var(--crm-sidebar-width)',
          backgroundColor: 'var(--crm-color-sidebar-bg)',
          borderRight: 'none',
        },
      }}
    >
      <SidebarContent collapsed={false} onNavigate={closeMobileNav} />
    </Drawer>
  );
}
