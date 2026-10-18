import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { AuditService } from "../../audit/services/audit.service";
import { IBranchRepository } from "../repositories/branch.repository";
import { BranchMapper, BranchResponseData } from "../mappers/branch.mapper";
import { BranchUsageService } from "../services/branch-usage.service";
import { BranchEntity } from "../domain/branch.entity";
import { branchErrors } from "../domain/branch.errors";
import { CreateBranchDtoType, UpdateBranchDtoType } from "../dtos/branch.dto";

interface Dependencies {
    branchRepository: IBranchRepository; branchMapper: BranchMapper; branchUsageService: BranchUsageService; auditService: AuditService;
}

// "Lekki Campus" -> LC ; "Greenfield Ikeja" -> GI ; a single word uses its first letters
function codeFromName(name: string): string {
    const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    let base = words.length > 1 ? words.slice(0, 4).map(w => w[0]).join("") : (words[0] ?? "BR").slice(0, 3);
    if (base.length < 2) base = (base + "BR").slice(0, 2);
    return base;
}

async function assertPrincipal(staffId: string): Promise<void> {
    const staff = await getTenantClient().staff.findFirst({ where: { id: staffId, isActive: true }, select: { id: true } });
    if (!staff) throw branchErrors.principalInvalid();
}

/*
| CREATE BRANCH. The plan's `branches.max` limit is checked first (the main branch counts as one), so a plan
| with room for one branch simply answers PLAN_LIMIT_REACHED. The code is permanent and, if not given, made
| from the name and made unique.
*/
export class CreateBranchUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateBranchDtoType): Promise<BranchResponseData> {
        const d = this.d;
        await assertWithinPlanLimit(schoolId, "branch", 1);

        if (await d.branchRepository.findByName(dto.name)) throw branchErrors.nameTaken();
        if (dto.principalStaffId) await assertPrincipal(dto.principalStaffId);

        let code = dto.code;
        if (code) { if (await d.branchRepository.findByCode(code)) throw branchErrors.codeTaken(); }
        else {
            const base = codeFromName(dto.name);
            code = base;
            for (let i = 2; await d.branchRepository.findByCode(code); i++) {
                code = `${base.slice(0, 5)}${i}`.slice(0, 6);
                if (i > 99) throw branchErrors.codeTaken();
            }
        }

        const branch = await d.branchRepository.create({
            name: dto.name, code, isMain: false, isActive: true, address: dto.address ?? null, city: dto.city ?? null, state: dto.state ?? null,
            phone: dto.phone ?? null, email: dto.email ?? null, principalStaffId: dto.principalStaffId ?? null, createdById: actorUserId,
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "branch.created", entity: "Branch", entityId: branch.id, newValue: { name: branch.name, code: branch.code } });
        return d.branchMapper.toResponse(branch);
    }
}

export class UpdateBranchUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateBranchDtoType): Promise<BranchResponseData> {
        const d = this.d;
        const branch = await d.branchRepository.findById(id);
        if (!branch) throw branchErrors.notFound();

        if (dto.name && dto.name.toLowerCase() !== branch.name.toLowerCase() && await d.branchRepository.findByName(dto.name)) throw branchErrors.nameTaken();
        if (dto.principalStaffId) await assertPrincipal(dto.principalStaffId);

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        for (const [k, v] of Object.entries(dto)) {
            const cur = (branch as unknown as Record<string, unknown>)[k];
            if (v !== undefined && v !== cur) { before[k] = cur; after[k] = v; }
        }
        if (!Object.keys(after).length) return d.branchMapper.toResponse(branch);

        const updated = await d.branchRepository.update(id, after);
        await d.auditService.log({ userId: actorUserId, schoolId, action: "branch.updated", entity: "Branch", entityId: id, oldValue: before, newValue: after });
        return d.branchMapper.toResponse(updated);
    }
}

// Deactivate = stop using it (kept, with all its history). Reactivating needs room in the plan again.
export class SetBranchActiveUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, active: boolean): Promise<BranchResponseData> {
        const d = this.d;
        const branch = await d.branchRepository.findById(id);
        if (!branch) throw branchErrors.notFound();
        if (branch.isActive === active) return d.branchMapper.toResponse(branch);

        if (!active) {
            if (branch.isMain) throw branchErrors.mainProtected("deactivated");
            const inUse = await d.branchUsageService.inUse(id);
            if (inUse > 0) throw branchErrors.inUse(inUse);
        } else {
            await assertWithinPlanLimit(schoolId, "branch", 1);
        }
        const updated = await d.branchRepository.update(id, { isActive: active });
        await d.auditService.log({ userId: actorUserId, schoolId, action: active ? "branch.reactivated" : "branch.deactivated", entity: "Branch", entityId: id });
        return d.branchMapper.toResponse(updated);
    }
}

// Delete = hide for good (soft delete). Only an inactive, empty, non-main branch.
export class DeleteBranchUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string): Promise<{ deleted: true }> {
        const d = this.d;
        const branch: BranchEntity | null = await d.branchRepository.findById(id);
        if (!branch) throw branchErrors.notFound();
        if (branch.isMain) throw branchErrors.mainProtected("deleted");
        if (branch.isActive) throw branchErrors.notDeactivated();
        const inUse = await d.branchUsageService.inUse(id);
        if (inUse > 0) throw branchErrors.inUse(inUse);

        await d.branchRepository.delete(id);
        await d.auditService.log({ userId: actorUserId, schoolId, action: "branch.deleted", entity: "Branch", entityId: id });
        return { deleted: true };
    }
}
