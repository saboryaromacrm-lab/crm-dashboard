/**
 * Responsive breakpoints — the single source of truth shared by JS (useBreakpoint)
 * and referenced by CSS media queries. Mobile-first thresholds:
 *   mobile:  < 768px
 *   tablet:  768px – 1023px
 *   desktop: >= 1024px
 */
export const BREAKPOINTS = Object.freeze({
  tablet: 768,
  desktop: 1024,
});

export const DEVICE = Object.freeze({
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
});
