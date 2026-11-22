import type { Access } from "../../../foundation/access.service";
import { PERMISSION_REGISTRY } from "../../../foundation/permissions.registry";
import type { EntitlementsService } from "../../../foundation/entitlements.service";
import type { IBranchRepository } from "../../branches/repositories/branch.repository";
import { BranchRef, buildMyPermissions, MyPermissionsResponse } from "../domain/my-permissions";

type LoadBranches = () => Promise<BranchRef[]>;
type LoadEntitlements = (schoolId: string) => ReturnType<EntitlementsService["effectiveFlags"]>;

/* GET /users/me/permissions: what this session may do. Never reads anything about other people. */
export class MyPermissionsUseCase {
    private readonly loadBranches: LoadBranches;
    private readonly loadEntitlements: LoadEntitlements;
    private readonly loadNotReady: () => Promise<string[]>;

    // The container passes its dependencies as the first argument; the second is only for tests.
    constructor(deps: { branchRepository?: IBranchRepository; entitlementsService?: EntitlementsService } = {}, loadBranches?: LoadBranches, loadEntitlements?: LoadEntitlements, loadNotReady?: () => Promise<string[]>) {
        // Active, not deleted, main branch first. Only school sessions have a school database to read.
        this.loadBranches = loadBranches ?? (async () => {
            const rows = await deps.branchRepository!.findMany({ isActive: true }, undefined, [{ isMain: "desc" }, { name: "asc" }] as any);
            return rows.map(b => ({ id: b.id, name: b.name, isMain: b.isMain }));
        });
        this.loadEntitlements = loadEntitlements ?? ((schoolId) => deps.entitlementsService!.effectiveFlags(schoolId));
        this.loadNotReady = loadNotReady ?? (() => deps.entitlementsService!.notReadyFeatures());
    }

    /** `schoolId` is the school the request host resolved to (req.schoolId); a platform session has none. */
    async execute(access: Access, schoolId?: string): Promise<MyPermissionsResponse> {
        const school = access.realm === "school";
        const [branches, entitlements, notReady] = school && schoolId
            ? await Promise.all([this.loadBranches(), this.loadEntitlements(schoolId), this.loadNotReady()])
            : [school ? await this.loadBranches() : [], null, null];
        return buildMyPermissions(access, PERMISSION_REGISTRY.map(p => p.key), branches, entitlements, notReady);
    }
}
