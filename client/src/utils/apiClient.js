const trimTrailingSlash = (value) => (value.endsWith('/') ? value.slice(0, -1) : value);

export const getApiBaseUrl = () => {
  const runtimeConfig = typeof window !== 'undefined' ? window.__BINGO_RUNTIME_CONFIG__ : undefined;
  const runtimeValue = runtimeConfig?.apiBaseUrl;
  const windowValue = typeof window !== 'undefined' ? window.__BINGO_API_URL__ : undefined;
  const envValue = import.meta.env.VITE_API_URL;
  const candidate = (runtimeValue || windowValue || envValue || '').trim();

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
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

export const apiFetch = (path, options) => fetch(buildApiUrl(path), options);
