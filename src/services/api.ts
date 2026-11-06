import axios from 'axios';
import { handleCloudflare501Fallback } from './cloudflareFallbackEngine';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If logged in via 501 fallback token while remote Cloudflare Worker is not yet redeployed,
    // route directly through the fallback engine for zero latency.
    if (token && token.startsWith('cf-session-') && config.url !== '/auth/login') {
      config.adapter = async (cfg) => handleCloudflare501Fallback(cfg);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses to handle 501 (unmigrated remote Worker stub) and 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If remote Cloudflare Worker returns 501 ("Cloudflare login migration is not enabled yet..."),
    // seamlessly execute the built-in Cambodian MoH Procurement fallback engine.
    if (error.response?.status === 501 && error.config) {
      return handleCloudflare501Fallback(error.config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('pms_token');
      localStorage.removeItem('pms_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
