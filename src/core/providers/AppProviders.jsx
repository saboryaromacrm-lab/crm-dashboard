import { ThemeModeProvider } from '@core/theme/ThemeModeContext.jsx';
import { AuthProvider } from '@core/auth/AuthContext.jsx';
import { PermissionProvider } from '@core/permissions/PermissionContext.jsx';
import { UIProvider } from '@core/context/UIContext.jsx';

/**
 * Single composition point for every global provider.
 *
 * Order matters and encodes the dependency graph:
 *   Theme  -> visual shell, independent of everything
 *   Auth   -> establishes the user
 *   Permission -> derives from Auth, so it must nest inside it
 *   UI     -> layout state, innermost so it can read the above if needed
 *
 * Adding a new cross-cutting provider (i18n, notifications, feature flags) is a
 * one-line change here and nowhere else.
 */
export function AppProviders({ children }) {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <PermissionProvider>
          <UIProvider>{children}</UIProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}
