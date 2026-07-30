import { useEffect } from 'react';
import { appConfig } from '@core/config/app.config.js';

/**
 * Sets `document.title` to "<page> · <app>" while the component is mounted.
 * @param {string} [title]
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${appConfig.name}` : appConfig.name;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
