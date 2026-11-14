import type { Scope } from "@schoolos/contracts";

/** One role of the school, as GET /roles returns it. */
export interface RoleSummary {
	id: string;
	name: string;
	description: string | null;
	kind: string;
	persona: "STAFF" | "STUDENT" | "GUARDIAN";
	grantsAll: boolean;
	isCustomized: boolean;
	sourceTemplateKey: string | null;
	editable: boolean;
	permissions: Array<{ key: string; scope: Scope }>;
	memberCount: number;
}

/** One entry of GET /permissions: a permission a role can be built from. */
export interface PermissionCatalogEntry {
	key: string;
	module: string;
	scopes: Scope[];
	personas: Array<"STAFF" | "STUDENT" | "GUARDIAN">;
	label: string;
	description: string | null;
	isSensitive: boolean;
}
