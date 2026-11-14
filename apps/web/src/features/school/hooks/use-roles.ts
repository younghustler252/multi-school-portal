import { useQuery } from "@tanstack/react-query";
import { roleApi } from "../services/role.api";

export function useRoles(enabled = true) {
	return useQuery({ queryKey: ["roles"], queryFn: roleApi.list, enabled });
}

export function usePermissionCatalog(enabled = true) {
	return useQuery({ queryKey: ["permissions", "catalog"], queryFn: roleApi.permissionCatalog, enabled });
}
