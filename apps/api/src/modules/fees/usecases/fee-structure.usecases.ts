import { IFeeStructureRepository, NewStructureItem } from "../repositories/fee-structure.repository";
import { IFeeTypeRepository } from "../repositories/fee-type.repository";
import { FeeStructureMapper } from "../mappers/fee-structure.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { feeErrors } from "../domain/fee.errors";
import { FeeStructureEntity } from "../domain/fee.entity";
import { CreateFeeStructureDtoType, UpdateFeeStructureDtoType, ListFeeStructuresQueryType } from "../dtos/fee-setup.dto";

interface Dependencies {
    feeStructureRepository: IFeeStructureRepository; feeTypeRepository: IFeeTypeRepository; feeStructureMapper: FeeStructureMapper; auditService: AuditService;
}

async function load(repo: IFeeStructureRepository, id: string): Promise<FeeStructureEntity> {
    const s = await repo.findById(id);
    if (!s) throw feeErrors.structureNotFound();
    return s;
}

// Each fee type once, every one active, in the order given
async function checkItems(types: IFeeTypeRepository, items: { feeTypeId: string; amountKobo: bigint; sortOrder?: number }[]): Promise<NewStructureItem[]> {
    const ids = items.map(i => i.feeTypeId);
    if (new Set(ids).size !== ids.length) throw feeErrors.duplicateStructureItem();
    const found = new Map((await types.findByIds(ids)).map(t => [t.id, t]));
    return items.map((item, index) => {
        const type = found.get(item.feeTypeId);
        if (!type) throw feeErrors.feeTypeNotFound();
        if (!type.isActive) throw feeErrors.feeTypeInactive(type.name);
        return { feeTypeId: item.feeTypeId, amountKobo: item.amountKobo, sortOrder: item.sortOrder ?? index };
    });
}

export class ListFeeStructuresUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListFeeStructuresQueryType) {
        return (await this.d.feeStructureRepository.listFiltered(q)).map(s => this.d.feeStructureMapper.toResponse(s));
    }
}

export class GetFeeStructureUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.feeStructureMapper.toResponse(await load(this.d.feeStructureRepository, id)); }
}

/*
| SET WHAT A CLASS PAYS FOR A TERM. Scope = term + class (empty = every class) + branch (empty = every branch) + student type.
| One structure per scope, so a student never matches two. Where it applies cannot change later: make a new structure instead.
*/
export class CreateFeeStructureUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateFeeStructureDtoType) {
        const repo = this.d.feeStructureRepository;
        if (!(await repo.sessionExists(dto.sessionId))) throw feeErrors.refNotFound("The session");
        const termSession = await repo.termSessionId(dto.termId);
        if (!termSession) throw feeErrors.refNotFound("The term");
        if (termSession !== dto.sessionId) throw feeErrors.termNotInSession();
        if (dto.classId && !(await repo.classExists(dto.classId))) throw feeErrors.refNotFound("The class");
        if (dto.branchId && !(await repo.branchExists(dto.branchId))) throw feeErrors.refNotFound("The branch");

        const scope = { termId: dto.termId, classId: dto.classId ?? null, branchId: dto.branchId ?? null, studentType: dto.studentType };
        if (await repo.findSameScope(scope)) throw feeErrors.structureOverlap();
        const items = await checkItems(this.d.feeTypeRepository, dto.items);

        const created = await repo.createWithItems({
            name: dto.name, sessionId: dto.sessionId, ...scope,
            dueDate: dto.dueDate ? parseDay(dto.dueDate) : null, description: dto.description ?? null, createdById: actorUserId, updatedById: actorUserId,
        }, items);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.structure.created", entity: "FeeStructure", entityId: created.id,
            newValue: { name: created.name, ...scope, items: created.items.map(i => ({ feeType: i.feeTypeCode, amountKobo: i.amountKobo.toString() })) },
        });
        return this.d.feeStructureMapper.toResponse(created);
    }
}

/* EDIT A STRUCTURE: name, due date, notes, on/off, and the list of fees (replaced as a whole). Invoices already made are not touched. */
export class UpdateFeeStructureUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateFeeStructureDtoType) {
        const repo = this.d.feeStructureRepository;
        const existing = await load(repo, id);
        const before = {
            name: existing.name, dueDate: existing.dueDate, description: existing.description, isActive: existing.isActive,
            items: existing.items.map(i => ({ feeType: i.feeTypeCode, amountKobo: i.amountKobo.toString() })),
        };

        const items = dto.items ? await checkItems(this.d.feeTypeRepository, dto.items) : undefined;
        const { items: _items, dueDate, ...rest } = dto;
        const updated = await repo.updateWithItems(id, {
            ...rest, ...(dueDate !== undefined && { dueDate: dueDate ? parseDay(dueDate) : null }), updatedById: actorUserId,
        }, items);

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.structure.updated", entity: "FeeStructure", entityId: id,
            oldValue: before,
            newValue: {
                name: updated.name, dueDate: updated.dueDate, description: updated.description, isActive: updated.isActive,
                items: updated.items.map(i => ({ feeType: i.feeTypeCode, amountKobo: i.amountKobo.toString() })),
            },
        });
        return this.d.feeStructureMapper.toResponse(updated);
    }
}

/* DELETE A STRUCTURE: only one no invoice came from. Otherwise deactivate it. */
export class DeleteFeeStructureUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const existing = await load(this.d.feeStructureRepository, id);
        if ((await this.d.feeStructureRepository.countInvoices(id)) > 0) throw feeErrors.structureInUse();
        await this.d.feeStructureRepository.delete(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "fees.structure.deleted", entity: "FeeStructure", entityId: id, oldValue: { name: existing.name } });
    }
}
