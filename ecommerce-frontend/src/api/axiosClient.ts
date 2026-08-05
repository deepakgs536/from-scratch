import axios from 'axios';
import { toast } from 'sonner';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatic JWT
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Error parsing, retry, toasts, 401/403
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle Network Errors / Retry logic (1 retry)
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        return await axiosClient(originalRequest);
      } catch (retryError) {
        const suppressError = (originalRequest as any).suppressError === true;
        if (!suppressError) {
          toast.error('Network Error: Please check your connection.');
        }
        return Promise.reject(retryError);
      }
    }

    if (error.response) {
      const { status, data } = error.response;
      const message = data?.error || data?.message || 'An error occurred';
      const suppressError = (originalRequest as any).suppressError === true;

      if (!suppressError) {
        if (status === 401) {
          toast.error('Session expired. Please login again.');
          localStorage.removeItem('token');
          // In a real app, redirect to login or dispatch logout action
          window.location.href = '/login';
        } else if (status === 403) {
          toast.error('You do not have permission to perform this action.');
        } else if (status >= 500) {
          toast.error('Server error. Please try again later.');
        } else {
          toast.error(message);
        }
      }
    }

    return Promise.reject(error);
  }
);
