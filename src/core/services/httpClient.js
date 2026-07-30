import { appConfig } from '@core/config/app.config.js';

/**
 * Thin, dependency-free HTTP client built on fetch.
 *
 * Every module's service layer goes through this single client so that
 * cross-cutting concerns (base URL, auth header, timeout, error normalization,
 * future retry/telemetry) are configured in ONE place. Swapping to axios or
 * adding interceptors later means editing this file only.
 */

class HttpError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, { body, headers, signal } = {}) {
  const url = path.startsWith('http')
    ? path
    : `${appConfig.api.baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.api.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // TODO: inject Authorization from the token store when auth is wired.
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: signal ?? controller.signal,
    });

    const isJson = (response.headers.get('content-type') ?? '').includes(
      'application/json',
    );
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new HttpError(`Request failed: ${response.status}`, {
        status: response.status,
        data,
      });
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const httpClient = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

export { HttpError };
