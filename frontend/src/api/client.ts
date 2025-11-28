import axios, { type AxiosError, type AxiosResponse } from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      try {
        await axios.post(
          "/api/auth/refresh",
          {},
          {
            withCredentials: true
          }
        );
        return apiClient.request(error.config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
