import type { Access } from "../../../foundation/access.service";
import { PERMISSION_REGISTRY } from "../../../foundation/permissions.registry";
import type { IBranchRepository } from "../../branches/repositories/branch.repository";
import type { EntitlementsService } from "../../../foundation/entitlements.service";
import { BranchRef, buildMyPermissions, entitlementsFor, MyPermissionsResponse } from "../domain/my-permissions";

type LoadBranches = () => Promise<BranchRef[]>;

/* GET /users/me/permissions: what this session may do. Never reads anything about other people. */
export class MyPermissionsUseCase {
    private readonly loadBranches: LoadBranches;

    // The container passes its dependencies as the first argument; the second is only for tests.
    private readonly entitlements?: Pick<EntitlementsService, "describeForSchool">;
    constructor(deps: { branchRepository?: IBranchRepository; entitlementsService?: Pick<EntitlementsService, "describeForSchool"> } = {}, loadBranches?: LoadBranches) {
        this.entitlements = deps.entitlementsService;
        // Active, not deleted, main branch first. Only school sessions have a school database to read.
        this.loadBranches = loadBranches ?? (async () => {
            const rows = await deps.branchRepository!.findMany({ isActive: true }, undefined, [{ isMain: "desc" }, { name: "asc" }] as any);
            return rows.map(b => ({ id: b.id, name: b.name, isMain: b.isMain }));
        });
    }

    async execute(access: Access, schoolId?: string | null): Promise<MyPermissionsResponse> {
        const branches = access.realm === "school" ? await this.loadBranches() : [];
        const out = buildMyPermissions(access, PERMISSION_REGISTRY.map(p => p.key), branches);
        if (access.realm === "school" && schoolId && schoolId !== "PUBLIC" && this.entitlements) {
            out.entitlements = entitlementsFor(access, await this.entitlements.describeForSchool(schoolId));
        }
        return out;
    }
}
