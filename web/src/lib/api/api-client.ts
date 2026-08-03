import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { authApi } from "@/features/auth/services/auth.api";
import { ApiErrorResponse, ApiResponse } from "@/types/api-response";
import { getApiBaseUrl } from "./get-api-base-url";


const axiosInstance: AxiosInstance = axios.create({
	baseURL: getApiBaseUrl(),
	headers: {
		"Content-Type": "application/json",
	},
	withCredentials: true,
});

// No request interceptor needed — cookies are sent automatically by the browser.
// Nothing to manually attach here anymore.

let isRefreshing = false;

axiosInstance.interceptors.response.use(
	(response) => response,
	async (error: AxiosError<ApiErrorResponse>) => {
		const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

		if (error.response?.status === 401 && !isRefreshing && originalRequest) {
			isRefreshing = true;
			try {
				// Refresh cookie is sent automatically; backend rotates both cookies on success
				const refreshRes = await authApi.refresh();
				isRefreshing = false;
				if (refreshRes.success) {
					return axiosInstance(originalRequest);
				}
			} catch {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	}
);

async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
	try {
		const response = await axiosInstance.request<ApiResponse<T>>(config);
		return response.data;
	} catch (err) {
		const axiosErr = err as AxiosError<ApiErrorResponse>;

		if (axiosErr.response?.data) {
			return axiosErr.response.data;
		}

		return {
			success: false,
			message: axiosErr.message || "Network error",
		};
	}
}

export const API = {
	get: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
		request<T>({ ...config, method: "GET", url }),

	post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
		request<T>({ ...config, method: "POST", url, data }),

	put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
		request<T>({ ...config, method: "PUT", url, data }),

	patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
		request<T>({ ...config, method: "PATCH", url, data }),

	delete: <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> =>
		request<T>({ ...config, method: "DELETE", url }),

	downloadFile: async (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
		const response = await axiosInstance.request<Blob>({ ...config, method: "GET", url, responseType: "blob" });
		return response.data;
	},
};
