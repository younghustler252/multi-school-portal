import { useMemo } from "react";
import { accessOf, type MyPermissions } from "@schoolos/contracts";
import { useAuthStore } from "@/stores/auth.store";

const NOTHING: MyPermissions = {
	realm: "school",
	persona: null,
	roles: [],
	holdsEverything: false,
	permissions: [],
	branches: { all: [], assigned: [], schoolHasSeveral: false },
};

/*
| What the signed-in session may do, for deciding what to SHOW (buttons, menu entries, pickers).
| Until permissions are loaded everything reads as "not allowed". The API still checks every request.
|   const me = useAccess();  if (me.can("fees.types.manage")) ...
*/
export function useAccess() {
	const permissions = useAuthStore((s) => s.permissions);
	return useMemo(() => accessOf(permissions ?? NOTHING), [permissions]);
}
