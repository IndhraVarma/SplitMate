import axios from 'axios';

/**
 * The single HTTP client.
 *
 * The base URL always comes from VITE_API_BASE_URL so no production host is
 * ever hard-coded. In development it falls back to the local API.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const TOKEN_STORAGE_KEY = 'splitmate.token';

export const api = axios.create({
  baseURL,
  // Sends the auth cookie when the API is same-site; harmless otherwise.
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Private browsing can throw on storage access; the app still works, the
    // session just does not survive a reload.
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable - ignore */
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called by AuthContext so an expired session can bounce the user to sign-in. */
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/**
 * A normalised error every screen can rely on:
 * { message, code, status, details: [{field, message}], fieldErrors }
 */
export class ApiError extends Error {
  constructor({ message, code, status, details }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details || [];
    this.fieldErrors = Object.fromEntries((details || []).map((d) => [d.field, d.message]));
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new ApiError({ message: 'The server took too long to respond. Try again.', code: 'TIMEOUT' })
      );
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError({
          message: 'Could not reach the server. Check your connection and try again.',
          code: 'NETWORK_ERROR',
        })
      );
    }

    const { status, data } = error.response;
    const payload = (data && data.error) || {};

    if (status === 401 && onUnauthorized) onUnauthorized(payload.code);

    return Promise.reject(
      new ApiError({
        message: payload.message || 'Something went wrong. Please try again.',
        code: payload.code || 'ERROR',
        status,
        details: payload.details,
      })
    );
  }
);

/** Unwraps the { success, data, meta } envelope the API always returns. */
export async function request(promise) {
  const response = await promise;
  return { data: response.data.data, meta: response.data.meta, message: response.data.message };
}

export default api;
