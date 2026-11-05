import type { Access } from "../../../foundation/access.service";
import { PERMISSION_REGISTRY } from "../../../foundation/permissions.registry";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { BranchRef, buildMyPermissions, MyPermissionsResponse } from "../domain/my-permissions";

type LoadBranches = () => Promise<BranchRef[]>;

// Active, not deleted, main branch first. Only school sessions have a school database to read.
const loadActiveBranches: LoadBranches = async () =>
    (await getTenantClient().branch.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, isMain: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }] }));

/* GET /users/me/permissions: what this session may do. Never reads anything about other people. */
export class MyPermissionsUseCase {
    // The container passes its dependencies as the first argument (none are needed); the second is only for tests.
    constructor(_deps: object = {}, private readonly loadBranches: LoadBranches = loadActiveBranches) {}

    async execute(access: Access): Promise<MyPermissionsResponse> {
        const branches = access.realm === "school" ? await this.loadBranches() : [];
        return buildMyPermissions(access, PERMISSION_REGISTRY.map(p => p.key), branches);
    }
}
