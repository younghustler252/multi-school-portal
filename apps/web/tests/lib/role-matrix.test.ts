import { describe, expect, it } from "vitest";
import { groupByModule, moduleAccess, moduleLabel } from "@/features/school/lib/role-matrix";
import type { PermissionCatalogEntry } from "@/features/school/types/role.types";

const entry = (key: string, module: string): PermissionCatalogEntry =>
	({ key, module, scopes: ["ALL"], personas: ["STAFF"], label: key, description: null, isSensitive: false });

describe("groupByModule", () => {
	it("keeps catalog order and groups keys by module", () => {
		const out = groupByModule([entry("fees.view", "fees"), entry("staff.view", "staff"), entry("fees.manage", "fees")]);
		expect(out).toEqual([{ module: "fees", keys: ["fees.view", "fees.manage"] }, { module: "staff", keys: ["staff.view"] }]);
	});
});

describe("moduleAccess", () => {
	const keys = ["fees.view", "fees.manage"];
	it("a grants-everything role has full access to every module", () => {
		expect(moduleAccess({ grantsAll: true, permissions: [] }, keys)).toEqual({ scope: "ALL", held: 2, total: 2 });
	});
	it("takes the widest scope held in the module and ignores other modules", () => {
		const role = { grantsAll: false, permissions: [{ key: "fees.view", scope: "OWN" as const }, { key: "fees.manage", scope: "BRANCH" as const }, { key: "staff.view", scope: "ALL" as const }] };
		expect(moduleAccess(role, keys)).toEqual({ scope: "BRANCH", held: 2, total: 2 });
	});
	it("no permission in the module means no access", () => {
		expect(moduleAccess({ grantsAll: false, permissions: [{ key: "staff.view", scope: "ALL" }] }, keys)).toEqual({ scope: null, held: 0, total: 2 });
	});
});

describe("moduleLabel", () => {
	it("turns module keys into readable labels", () => {
		expect(moduleLabel("report-cards")).toBe("Report cards");
		expect(moduleLabel("billing_setup")).toBe("Billing setup");
	});
});
