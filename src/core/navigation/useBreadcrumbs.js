import { useMemo } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import { appConfig } from '@core/config/app.config.js';

/**
 * Derives breadcrumb segments from the active route.
 *
 * Prefers route `handle.crumb` metadata (set per route) and falls back to
 * humanizing the URL path. Returns [{ label, to, isLast }].
 */
export function useBreadcrumbs() {
  const location = useLocation();
  const matches = useMatches();

  return useMemo(() => {
    const home = { label: 'Inicio', to: appConfig.routes.defaultAuthenticatedRoute, isLast: false };

    // Route-provided crumbs take priority when present.
    const routeCrumbs = matches
      .filter((m) => m.handle && m.handle.crumb)
      .map((m) => ({
        label:
          typeof m.handle.crumb === 'function'
            ? m.handle.crumb(m)
            : m.handle.crumb,
        to: m.pathname,
        isLast: false,
      }));

    let crumbs = routeCrumbs;
    if (crumbs.length === 0) {
      // Fallback: build from the pathname.
      const segments = location.pathname.split('/').filter(Boolean);
      let acc = '';
      crumbs = segments.map((seg) => {
        acc += `/${seg}`;
        return { label: humanize(seg), to: acc, isLast: false };
      });
    }

    const all = [home, ...crumbs];
    return all.map((c, i) => ({ ...c, isLast: i === all.length - 1 }));
  }, [location.pathname, matches]);
}

function humanize(segment) {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
