import { useAuthStore } from "@/stores/auth.store";
import { Role } from "@/types/roles";

export function useIsReadOnly(readOnlyRoles: Role[] = ["principal"]): boolean {
	const role = useAuthStore((s) => s.user?.role);
	return !!role && readOnlyRoles.includes(role);
}