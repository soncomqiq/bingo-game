const trimTrailingSlash = (value) => (value.endsWith('/') ? value.slice(0, -1) : value);

export const getApiBaseUrl = () => {
  const runtimeConfig = typeof window !== 'undefined' ? window.__BINGO_RUNTIME_CONFIG__ : undefined;
  const runtimeValue = runtimeConfig?.apiBaseUrl;
  const windowValue = typeof window !== 'undefined' ? window.__BINGO_API_URL__ : undefined;
  const envValue = import.meta.env.VITE_API_URL;
  const runtimeSocket = runtimeConfig?.socketUrl;
  const windowSocket = typeof window !== 'undefined' ? window.__BINGO_SOCKET_URL__ : undefined;
  const envSocket = import.meta.env.VITE_SOCKET_URL;
  const candidate = (
    runtimeValue ||
    windowValue ||
    envValue ||
    runtimeSocket ||
    windowSocket ||
    envSocket ||
    ''
  ).trim();

  if (candidate) {
    return trimTrailingSlash(candidate);
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }

  return '';
};

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) {
    if (import.meta.env.PROD) {
      console.warn('API base URL missing; falling back to relative request for', normalizedPath);
    }
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

export const apiFetch = (path, options) => fetch(buildApiUrl(path), options);
