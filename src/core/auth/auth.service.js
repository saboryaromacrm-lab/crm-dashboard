import { appConfig } from '@core/config/app.config.js';

/**
 * Authentication service (stub).
 *
 * Encapsulates ALL auth I/O behind a stable interface so the rest of the app
 * depends on this contract, not on any particular backend. When a real backend
 * exists, only this file changes — swap the mocked promises for httpClient
 * calls and token storage.
 */

const MOCK_USER = {
  id: 'usr_local_admin',
  name: 'Administrador',
  email: 'admin@saboryaroma.local',
  roles: ['admin'],
  // Permission strings follow the "<resource>:<action>" convention.
  permissions: ['*'],
  tenantId: 'tnt_default',
};

export const authService = {
  /** Returns the current session user, or null if unauthenticated. */
  async getCurrentUser() {
    // TODO: replace with `await httpClient.get('/auth/me')`.
    return MOCK_USER;
  },

  async login(credentials) {
    // TODO: POST credentials, persist token, return user.
    void credentials;
    return MOCK_USER;
  },

  async logout() {
    // TODO: invalidate token server-side + clear storage.
    return true;
  },

  get defaultRoute() {
    return appConfig.routes.defaultAuthenticatedRoute;
  },
};
