import axios from 'axios';

export const getApiUrl = (): string =>
  import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
});
