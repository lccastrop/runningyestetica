import axios from 'axios';

export const getApiUrl = (): string =>
  import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
});