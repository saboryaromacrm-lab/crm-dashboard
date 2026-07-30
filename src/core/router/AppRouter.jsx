import { Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { MainLayout } from '@core/layout/MainLayout.jsx';
import { ProtectedRoute } from './guards/ProtectedRoute.jsx';
import { moduleRegistry } from '@core/modules/registry.js';
import { appConfig } from '@core/config/app.config.js';
import { FullScreenLoader } from '@shared/components/FullScreenLoader/FullScreenLoader.jsx';
import { NotFoundPage } from './NotFoundPage.jsx';
import { LoginPage } from './LoginPage.jsx';
import { RouteErrorBoundary } from './RouteErrorBoundary.jsx';

/**
 * APPLICATION ROUTER
 * ============================================================================
 * The route tree is GENERATED from the module registry, not hand-written:
 *
 *   /login                      public
 *   /            ProtectedRoute -> MainLayout
 *     (index)                   -> redirect to default route
 *     /dashboard   from module  ┐ every active module's routes are injected
 *     /customers   from module  ┘ here automatically
 *   *                           -> 404
 *
 * Adding a module never touches this file — its routes appear via
 * `moduleRegistry.getRouteObjects()`.
 */
function buildRouter() {
  const moduleRoutes = moduleRegistry.getRouteObjects();

  const router = createBrowserRouter([
    {
      path: appConfig.routes.login,
      element: <LoginPage />,
    },
    {
      path: '/',
      element: <ProtectedRoute />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          element: <MainLayout />,
          children: [
            {
              index: true,
              element: (
                <Navigate to={appConfig.routes.defaultAuthenticatedRoute} replace />
              ),
            },
            ...moduleRoutes,
          ],
        },
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ]);

  return router;
}

export function AppRouter() {
  const router = buildRouter();
  return (
    <Suspense fallback={<FullScreenLoader label="Cargando…" />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
