import type { Access } from "../../../foundation/access.service";
import { PERMISSION_REGISTRY } from "../../../foundation/permissions.registry";
import type { IBranchRepository } from "../../branches/repositories/branch.repository";
import { BranchRef, buildMyPermissions, MyPermissionsResponse } from "../domain/my-permissions";

type LoadBranches = () => Promise<BranchRef[]>;

/* GET /users/me/permissions: what this session may do. Never reads anything about other people. */
export class MyPermissionsUseCase {
    private readonly loadBranches: LoadBranches;

    // The container passes its dependencies as the first argument; the second is only for tests.
    constructor(deps: { branchRepository?: IBranchRepository } = {}, loadBranches?: LoadBranches) {
        // Active, not deleted, main branch first. Only school sessions have a school database to read.
        this.loadBranches = loadBranches ?? (async () => {
            const rows = await deps.branchRepository!.findMany({ isActive: true }, undefined, [{ isMain: "desc" }, { name: "asc" }] as any);
            return rows.map(b => ({ id: b.id, name: b.name, isMain: b.isMain }));
        });
    }

    async execute(access: Access): Promise<MyPermissionsResponse> {
        const branches = access.realm === "school" ? await this.loadBranches() : [];
        return buildMyPermissions(access, PERMISSION_REGISTRY.map(p => p.key), branches);
    }
}
