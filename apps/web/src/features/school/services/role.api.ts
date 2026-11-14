import { apiCall } from "@/lib/api/api-client";
import type { PermissionCatalogEntry, RoleSummary } from "../types/role.types";

// Both calls need roles.view and throw ApiError on failure.
export const roleApi = {
	list: (): Promise<RoleSummary[]> => apiCall<RoleSummary[]>({ method: "GET", url: "/roles" }),
	permissionCatalog: (): Promise<PermissionCatalogEntry[]> => apiCall<PermissionCatalogEntry[]>({ method: "GET", url: "/permissions" }),
};
