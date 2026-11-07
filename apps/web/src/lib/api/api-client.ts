import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { ApiResponse } from "@/types/api-response";
import { getApiBaseUrl } from "./get-api-base-url";
import { API_CODES, ApiError, normalizeApiError } from "./api-error";
import { endsSession, isSessionlessAuthUrl, shouldRefreshFor } from "./refresh-rules";
import { createRefreshCoordinator, RefreshInProgressError } from "./refresh-coordinator";
import { emitMustChangePassword, emitSessionEnded } from "./session-events";

const axiosInstance: AxiosInstance = axios.create({
	baseURL: getApiBaseUrl(),
	headers: { "Content-Type": "application/json" },
	withCredentials: true,
});

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const refreshCoordinator = createRefreshCoordinator({
	refresh: async () => {
		try {
			await axiosInstance.request({ method: "POST", url: "/auth/refresh" });
			return true;
		} catch (err) {
			const apiErr = err instanceof ApiError ? err : normalizeApiError(null, null);
			if (apiErr.code === API_CODES.REFRESH_IN_PROGRESS) throw new RefreshInProgressError();
			// Network failure is not proof the session is dead, but we cannot continue either; treat as ended.
			return false;
		}
	},
});

// A blob request that fails still has a JSON error body, just wrapped in a Blob.
async function readErrorBody(data: unknown): Promise<unknown> {
	if (typeof Blob !== "undefined" && data instanceof Blob) {
		try {
			return JSON.parse(await data.text());
		} catch {
			return null;
		}
	}
	return data;
}

axiosInstance.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const body = await readErrorBody(error.response?.data);
		const apiErr = normalizeApiError(error.response?.status, body);
		const config = error.config as RetryableConfig | undefined;

		if (apiErr.code === API_CODES.MAINTENANCE_MODE && typeof window !== "undefined" && window.location.pathname !== "/maintenance") {
			window.location.href = "/maintenance";
			throw apiErr;
		}

		if (apiErr.code === API_CODES.MUST_CHANGE_PASSWORD) {
			emitMustChangePassword();
			throw apiErr;
		}

		const ended = endsSession(apiErr.status, apiErr.code);
		if (ended && !isSessionlessAuthUrl(config?.url)) {
			emitSessionEnded(ended);
			throw apiErr;
		}

		if (config && !config._retried && !isSessionlessAuthUrl(config.url) && shouldRefreshFor(apiErr.status, apiErr.code)) {
			config._retried = true;
			const outcome = await refreshCoordinator.refresh();
			if (outcome === "refreshed") return axiosInstance(config);
			emitSessionEnded("expired");
		}

		throw apiErr;
	},
);

/** Resolves with the response `data` field or throws ApiError. For new code and for hooks that want exceptions. */
export async function apiCall<T>(config: AxiosRequestConfig): Promise<T> {
	const response = await axiosInstance.request<{ data: T }>(config);
	return response.data?.data as T;
}

/** Envelope style used by the existing feature services: never throws, returns { success: false, ... } on failure. */
async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
	try {
		const response = await axiosInstance.request<ApiResponse<T>>(config);
		if (response.status === 204 || response.data == null || (response.data as unknown) === "") {
			return { success: true, message: "", data: null as T };
		}
		return response.data;
	} catch (err) {
		const apiErr = err instanceof ApiError ? err : normalizeApiError(null, null, err instanceof Error ? err.message : undefined);
		return { success: false, message: apiErr.message, code: apiErr.code, errors: Object.keys(apiErr.fieldErrors).length ? apiErr.fieldErrors : undefined };
	}
}

export const API = {
	get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: "GET", url }),
	post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: "POST", url, data }),
	put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: "PUT", url, data }),
	patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: "PATCH", url, data }),
	delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: "DELETE", url }),
	/** Throws ApiError on failure (the body is parsed out of the error blob). */
	downloadFile: async (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
		const response = await axiosInstance.request<Blob>({ ...config, method: "GET", url, responseType: "blob" });
		return response.data;
	},
};
