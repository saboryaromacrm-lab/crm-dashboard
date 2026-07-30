/**
 * Conditional className joiner (a tiny clsx). Filters falsy values so callers
 * can write: cx(styles.card, isActive && styles.active).
 * @param {...(string|false|null|undefined)} classes
 * @returns {string}
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
