import { env } from '@core/config/env.js';

/**
 * Tiny logging facade. Centralizes console usage so it can later be routed to a
 * telemetry backend (Sentry, Datadog) without touching call sites. In
 * production, debug/info are suppressed.
 */
const noop = () => {};

export const logger = {
  debug: env.isDevelopment ? console.debug.bind(console, '[crm]') : noop,
  info: env.isDevelopment ? console.info.bind(console, '[crm]') : noop,
  warn: console.warn.bind(console, '[crm]'),
  error: console.error.bind(console, '[crm]'),
};
