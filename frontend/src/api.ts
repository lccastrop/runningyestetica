import axios from 'axios';

export const getApiUrl = (): string =>
  import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
});

// Returns a base URL to serve static files (uploads) from the backend.
// Prefer explicit VITE_FILES_BASE_URL, then fall back to VITE_API_URL when it's absolute.
export const getFilesBaseUrl = (): string => {
  const files = (import.meta as any).env?.VITE_FILES_BASE_URL as string | undefined;
  const api = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (files && /^https?:\/\//i.test(files)) return files.replace(/\/$/, '');
  if (api && /^https?:\/\//i.test(api)) return api.replace(/\/$/, '');
  return '';
};
