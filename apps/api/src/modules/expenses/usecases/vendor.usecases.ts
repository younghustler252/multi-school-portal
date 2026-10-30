import { IVendorRepository } from "../repositories/vendor.repository";
import { VendorMapper } from "../mappers/vendor.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { expenseErrors } from "../domain/expense.errors";
import { VendorEntity } from "../domain/expense.entity";
import { CreateVendorDtoType, UpdateVendorDtoType, ListVendorsQueryType } from "../dtos/vendor.dto";

interface Dependencies { vendorRepository: IVendorRepository; vendorMapper: VendorMapper; auditService: AuditService; encryptionService: EncryptionService }

async function load(repo: IVendorRepository, id: string): Promise<VendorEntity> {
    const v = await repo.findById(id);
    if (!v) throw expenseErrors.vendorNotFound();
    return v;
}

const blankToNull = (v: string | undefined): string | null | undefined => (v === undefined ? undefined : v === "" ? null : v);

/* The bank account number is encrypted before it is saved; only the last four digits are kept in the clear. A blank clears it. */
function accountColumns(accountNumber: string | undefined, enc: EncryptionService): Record<string, unknown> {
    if (accountNumber === undefined) return {};
    if (accountNumber === "") return { accountNumberEncrypted: null, accountNumberLast4: null };
    return { accountNumberEncrypted: enc.encrypt(accountNumber), accountNumberLast4: accountNumber.slice(-4) };
}

export class ListVendorsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListVendorsQueryType) {
        const r = await this.d.vendorRepository.list({ q: q.q, status: q.status }, q.page, q.limit);
        return { data: r.data.map(v => this.d.vendorMapper.toResponse(v)), meta: r.meta };
    }
}

export class GetVendorUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.vendorMapper.toResponse(await load(this.d.vendorRepository, id)); }
}

export class CreateVendorUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateVendorDtoType) {
        const created = await this.d.vendorRepository.create({
            name: dto.name, contactName: blankToNull(dto.contactName) ?? null, phone: blankToNull(dto.phone) ?? null, email: blankToNull(dto.email) ?? null,
            address: blankToNull(dto.address) ?? null, bankName: blankToNull(dto.bankName) ?? null, accountName: blankToNull(dto.accountName) ?? null,
            taxId: blankToNull(dto.taxId) ?? null, notes: blankToNull(dto.notes) ?? null, createdById: actorUserId, updatedById: actorUserId,
            ...accountColumns(dto.accountNumber, this.d.encryptionService),
        });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "vendors.created", entity: "Vendor", entityId: created.id, newValue: { name: created.name } });
        return this.d.vendorMapper.toResponse(created);
    }
}

export class UpdateVendorUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateVendorDtoType) {
        const before = await load(this.d.vendorRepository, id);
        const { accountNumber, ...rest } = dto;
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) data[k] = k === "name" ? v : blankToNull(v as string | undefined);
        Object.assign(data, accountColumns(accountNumber, this.d.encryptionService));

        // Audit only what changed, and never the account number itself
        const changed: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(data)) {
            if (k === "accountNumberEncrypted") { changed.accountNumber = { from: before.hasAccountNumber ? `****${before.accountNumberLast4}` : null, to: v === null ? null : `****${accountNumber!.slice(-4)}` }; continue; }
            if (k === "accountNumberLast4") continue;
            const old = (before as unknown as Record<string, unknown>)[k];
            if (old !== v) changed[k] = { from: old, to: v };
        }
        if (Object.keys(changed).length === 0) return this.d.vendorMapper.toResponse(before);

        const updated = await this.d.vendorRepository.update(id, { ...data, updatedById: actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "vendors.updated", entity: "Vendor", entityId: id,
            oldValue: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.from])), newValue: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.to])),
        });
        return this.d.vendorMapper.toResponse(updated);
    }
}

export class SetVendorActiveUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, isActive: boolean) {
        const v = await load(this.d.vendorRepository, id);
        if (v.isActive === isActive) return this.d.vendorMapper.toResponse(v);
        const updated = await this.d.vendorRepository.update(id, { isActive, updatedById: actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: isActive ? "vendors.reactivated" : "vendors.deactivated", entity: "Vendor", entityId: id,
            oldValue: { isActive: v.isActive }, newValue: { isActive },
        });
        return this.d.vendorMapper.toResponse(updated);
    }
}

/* Deleting hides a vendor that was never used. One with expenses is only deactivated, so history keeps its names. */
export class DeleteVendorUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const v = await load(this.d.vendorRepository, id);
        if (await this.d.vendorRepository.hasExpenses(id)) throw expenseErrors.vendorInUse();
        await this.d.vendorRepository.delete(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "vendors.deleted", entity: "Vendor", entityId: id, oldValue: { name: v.name } });
        return { deleted: true };
    }
}
