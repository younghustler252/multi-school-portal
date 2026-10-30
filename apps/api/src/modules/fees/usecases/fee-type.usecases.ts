import { IFeeTypeRepository } from "../repositories/fee-type.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { FeeTypeMapper } from "../mappers/fee-type.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { feeErrors } from "../domain/fee.errors";
import { FEE_TYPE_CODE, codeFromName } from "../domain/fee.policy";
import { FeeTypeEntity } from "../domain/fee.entity";
import { CreateFeeTypeDtoType, UpdateFeeTypeDtoType, ListFeeTypesQueryType } from "../dtos/fee-setup.dto";

interface Dependencies {
    feeTypeRepository: IFeeTypeRepository; ledgerAccountRepository: ILedgerAccountRepository; feeTypeMapper: FeeTypeMapper; auditService: AuditService;
}

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

// Money earned must land in an active income account
async function checkIncomeAccount(repo: ILedgerAccountRepository, accountId: string): Promise<void> {
    const account = await repo.findById(accountId);
    if (!account || !account.isActive) throw feeErrors.incomeAccountInvalid("The income account does not exist or is not active");
    if (account.type !== "INCOME") throw feeErrors.incomeAccountInvalid("A fee must earn into an income account");
}

async function load(repo: IFeeTypeRepository, id: string): Promise<FeeTypeEntity> {
    const t = await repo.findById(id);
    if (!t) throw feeErrors.feeTypeNotFound();
    return t;
}

export class ListFeeTypesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListFeeTypesQueryType) {
        return (await this.d.feeTypeRepository.listFiltered({ status: q.status, q: q.q })).map(t => this.d.feeTypeMapper.toResponse(t));
    }
}

export class GetFeeTypeUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.feeTypeMapper.toResponse(await load(this.d.feeTypeRepository, id)); }
}

/* ADD A FEE TYPE. The code is made from the name when omitted and never changes afterwards. */
export class CreateFeeTypeUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateFeeTypeDtoType) {
        const code = dto.code ?? codeFromName(dto.name);
        if (!FEE_TYPE_CODE.test(code)) throw feeErrors.feeTypeCodeTaken(code || dto.name);      // a name with no usable letters
        if (await this.d.feeTypeRepository.codeExists(code)) throw feeErrors.feeTypeCodeTaken(code);
        await checkIncomeAccount(this.d.ledgerAccountRepository, dto.incomeAccountId);

        let created: FeeTypeEntity;
        try {
            created = await this.d.feeTypeRepository.create({
                code, name: dto.name, description: dto.description ?? null, incomeAccountId: dto.incomeAccountId,
                isRefundable: dto.isRefundable, sortOrder: dto.sortOrder, createdById: actorUserId,
            });
        } catch (e) {
            if (isUniqueViolation(e)) throw feeErrors.feeTypeCodeTaken(code);                      // two people added it at once
            throw e;
        }
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.type.created", entity: "FeeType", entityId: created.id,
            newValue: { code: created.code, name: created.name, incomeAccountId: created.incomeAccountId },
        });
        return this.d.feeTypeMapper.toResponse(created);
    }
}

/* EDIT A FEE TYPE. A new income account applies to invoices made from now on; old invoices keep the one they were made with. */
export class UpdateFeeTypeUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateFeeTypeDtoType) {
        const existing = await load(this.d.feeTypeRepository, id);
        const before = { name: existing.name, description: existing.description, incomeAccountId: existing.incomeAccountId, isRefundable: existing.isRefundable, isActive: existing.isActive, sortOrder: existing.sortOrder };

        if (dto.incomeAccountId && dto.incomeAccountId !== existing.incomeAccountId) await checkIncomeAccount(this.d.ledgerAccountRepository, dto.incomeAccountId);
        const updated = await this.d.feeTypeRepository.update(id, { ...dto });

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.type.updated", entity: "FeeType", entityId: id,
            oldValue: before,
            newValue: { name: updated.name, description: updated.description, incomeAccountId: updated.incomeAccountId, isRefundable: updated.isRefundable, isActive: updated.isActive, sortOrder: updated.sortOrder },
        });
        return this.d.feeTypeMapper.toResponse(updated);
    }
}

/* DELETE A FEE TYPE: only one that was never used. Anything used is deactivated instead (history keeps pointing at it). */
export class DeleteFeeTypeUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const existing = await load(this.d.feeTypeRepository, id);
        if (await this.d.feeTypeRepository.isUsed(id)) throw feeErrors.feeTypeInUse(existing.name);
        await this.d.feeTypeRepository.delete(id);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.type.deleted", entity: "FeeType", entityId: id,
            oldValue: { code: existing.code, name: existing.name },
        });
    }
}
