import { IPayComponentRepository } from "../repositories/payroll.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ComponentMapper, bandsToJson } from "../mappers/payroll.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { PayComponentEntity } from "../domain/payroll.entity";
import { payrollErrors } from "../domain/payroll.errors";
import { checkComponent } from "../domain/payroll.policy";
import { CreateComponentDtoType, UpdateComponentDtoType, ListComponentsQueryType } from "../dtos/payroll.dto";

interface Dependencies { payComponentRepository: IPayComponentRepository; ledgerAccountRepository: ILedgerAccountRepository; componentMapper: ComponentMapper; auditService: AuditService }

async function load(repo: IPayComponentRepository, id: string): Promise<PayComponentEntity> {
    const c = await repo.findById(id);
    if (!c) throw payrollErrors.componentNotFound();
    return c;
}

/* The accounts must exist: an expense account for what the school spends, a liability account for what it owes on. */
async function checkAccounts(repo: ILedgerAccountRepository, expenseAccountId?: string | null, liabilityAccountId?: string | null) {
    if (expenseAccountId) {
        const a = await repo.findById(expenseAccountId);
        if (!a || !a.isActive || a.type !== "EXPENSE") throw payrollErrors.componentInvalid("The expense account must be an active expense account");
    }
    if (liabilityAccountId) {
        const a = await repo.findById(liabilityAccountId);
        if (!a || !a.isActive || a.type !== "LIABILITY") throw payrollErrors.componentInvalid("The liability account must be an active liability account");
    }
}

export class ListComponentsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListComponentsQueryType) {
        const r = await this.d.payComponentRepository.list({ type: q.type, status: q.status }, q.page, q.limit);
        return { data: r.data.map(c => this.d.componentMapper.toResponse(c)), meta: r.meta };
    }
}

export class GetComponentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.componentMapper.toResponse(await load(this.d.payComponentRepository, id)); }
}

export class CreateComponentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, actorUserId: string, dto: CreateComponentDtoType) {
        const d = this.d;
        const input = { type: dto.type, calcType: dto.calcType, defaultValue: dto.defaultValue, bands: dto.bands ?? null, expenseAccountId: dto.expenseAccountId, liabilityAccountId: dto.liabilityAccountId };
        checkComponent(input);
        await checkAccounts(d.ledgerAccountRepository, dto.expenseAccountId, dto.liabilityAccountId);
        if (await d.payComponentRepository.findByCode(dto.code)) throw payrollErrors.componentCodeTaken(dto.code);

        const created = await d.payComponentRepository.create({
            name: dto.name, code: dto.code, type: dto.type, calcType: dto.calcType, defaultValue: dto.defaultValue, bands: bandsToJson(dto.bands ?? null),
            isTaxable: dto.isTaxable ?? false, isStatutory: dto.isStatutory ?? false, expenseAccountId: dto.expenseAccountId ?? null, liabilityAccountId: dto.liabilityAccountId ?? null, createdById: actorUserId,
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.component.created", entity: "PayComponent", entityId: created.id, newValue: { code: dto.code, type: dto.type, calcType: dto.calcType } });
        return d.componentMapper.toResponse(created);
    }
}

/* Changes apply to pay calculated from now on: a payslip already made keeps the amounts and accounts it was made with. */
export class UpdateComponentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateComponentDtoType) {
        const d = this.d;
        const before = await load(d.payComponentRepository, id);
        const next = {
            type: before.type, calcType: before.calcType, defaultValue: dto.defaultValue ?? before.defaultValue, bands: dto.bands === undefined ? before.bands : (dto.bands as any),
            expenseAccountId: dto.expenseAccountId === undefined ? before.expenseAccountId : dto.expenseAccountId,
            liabilityAccountId: dto.liabilityAccountId === undefined ? before.liabilityAccountId : dto.liabilityAccountId,
        };
        checkComponent(next);
        await checkAccounts(d.ledgerAccountRepository, dto.expenseAccountId, dto.liabilityAccountId);

        const updated = await d.payComponentRepository.update(id, {
            ...(dto.name !== undefined && { name: dto.name }), defaultValue: next.defaultValue, bands: bandsToJson(next.bands),
            ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }), ...(dto.isStatutory !== undefined && { isStatutory: dto.isStatutory }),
            expenseAccountId: next.expenseAccountId, liabilityAccountId: next.liabilityAccountId,
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.component.updated", entity: "PayComponent", entityId: id,
            oldValue: { defaultValue: before.defaultValue.toString(), name: before.name }, newValue: { defaultValue: next.defaultValue.toString(), name: updated.name },
        });
        return d.componentMapper.toResponse(updated);
    }
}

export class SetComponentActiveUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, actorUserId: string, isActive: boolean) {
        const c = await load(this.d.payComponentRepository, id);
        if (c.isActive === isActive) return this.d.componentMapper.toResponse(c);
        const updated = await this.d.payComponentRepository.update(id, { isActive });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: isActive ? "payroll.component.reactivated" : "payroll.component.deactivated", entity: "PayComponent", entityId: id });
        return this.d.componentMapper.toResponse(updated);
    }
}

export class DeleteComponentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, actorUserId: string) {
        const c = await load(this.d.payComponentRepository, id);
        if (await this.d.payComponentRepository.inUse(id)) throw payrollErrors.componentInUse();
        await this.d.payComponentRepository.remove(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.component.deleted", entity: "PayComponent", entityId: id, oldValue: { code: c.code, name: c.name } });
        return { deleted: true };
    }
}
