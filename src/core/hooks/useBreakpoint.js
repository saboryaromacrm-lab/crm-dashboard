import { useMediaQuery } from './useMediaQuery.js';
import { BREAKPOINTS } from '@shared/constants/breakpoints.js';

/**
 * Central responsive hook. Mobile-first: everything is derived from the same
 * breakpoint constants used by the CSS, so JS and CSS never disagree.
 *
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean, device: 'mobile'|'tablet'|'desktop' }}
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.tablet - 1}px)`);
  const isTablet = useMediaQuery(
    `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
  );
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);

  const device = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  return { isMobile, isTablet, isDesktop, device };
}
