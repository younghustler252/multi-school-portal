import type { Scope } from "@schoolos/contracts";
import type { PermissionCatalogEntry, RoleSummary } from "../types/role.types";

/*
| The roles table in Settings: one row per permission module, one column per role, each cell the widest scope that
| role holds anywhere in that module. Built only from what the API returns (roles + permission catalog), so it can
| never disagree with what the backend enforces and needs no role names in the code.
*/

const RANK: Record<Scope, number> = { OWN: 1, ASSIGNED: 2, BRANCH: 3, ALL: 4 };

export interface ModuleAccess {
	/** Widest scope held in the module, or null when the role holds nothing there. */
	scope: Scope | null;
	/** How many of the module's permissions the role holds (all of them for a grants-everything role). */
	held: number;
	total: number;
}

/** Modules in catalog order, each with its permissions. */
export function groupByModule(catalog: PermissionCatalogEntry[]): Array<{ module: string; keys: string[] }> {
	const order: string[] = [];
	const keys = new Map<string, string[]>();
	for (const entry of catalog) {
		if (!keys.has(entry.module)) { keys.set(entry.module, []); order.push(entry.module); }
		keys.get(entry.module)!.push(entry.key);
	}
	return order.map((module) => ({ module, keys: keys.get(module)! }));
}

export function moduleAccess(role: Pick<RoleSummary, "grantsAll" | "permissions">, moduleKeys: string[]): ModuleAccess {
	const total = moduleKeys.length;
	if (role.grantsAll) return { scope: "ALL", held: total, total };
	const inModule = new Set(moduleKeys);
	let best: Scope | null = null;
	let held = 0;
	for (const p of role.permissions) {
		if (!inModule.has(p.key)) continue;
		held += 1;
		if (best === null || RANK[p.scope] > RANK[best]) best = p.scope;
	}
	return { scope: best, held, total };
}

/** "billing_setup" / "report-cards" -> "Billing setup" / "Report cards" (the API sends only the module key). */
export function moduleLabel(module: string): string {
	const words = module.replace(/[-_.]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
