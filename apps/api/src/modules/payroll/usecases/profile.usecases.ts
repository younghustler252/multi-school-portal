import { IPayComponentRepository, IPayProfileRepository, IPayrollContextRepository } from "../repositories/payroll.repositories";
import { ProfileMapper } from "../mappers/payroll.mapper";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { AuditService } from "../../audit/services/audit.service";
import { payrollErrors } from "../domain/payroll.errors";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { dayString } from "../../ledger/domain/ledger.dates";
import { SetProfileDtoType } from "../dtos/payroll.dto";
import { PayrollOptions } from "./payroll-shared";

interface Dependencies {
    payProfileRepository: IPayProfileRepository; payComponentRepository: IPayComponentRepository; payrollContextRepository: IPayrollContextRepository;
    profileMapper: ProfileMapper; encryptionService: EncryptionService; auditService: AuditService;
}

/*
| SET A STAFF MEMBER'S PAY from a date. History is kept: the profile in force is closed the day before and the new one starts.
| The bank account number is encrypted; only the last four digits are kept in the clear. Each component can carry its own value for this person.
| Everything about pay is audited, without the amounts being written in clear into the audit text.
*/
export class SetPayProfileUseCase {
    constructor(private readonly d: Dependencies, private readonly options: PayrollOptions = {}) {}

    async execute(schoolId: string, actorUserId: string, dto: SetProfileDtoType) {
        const d = this.d;
        const [staff] = await d.payrollContextRepository.staffInfo([dto.staffId]);
        if (!staff || !staff.isActive) throw payrollErrors.refNotFound("The staff member");

        parseDay(dto.effectiveFrom);
        const latest = await d.payProfileRepository.latest(dto.staffId);
        if (latest && dto.effectiveFrom <= dayString(latest.effectiveFrom)) {
            throw payrollErrors.profileDateInvalid(`A new pay profile must start after the current one, which starts on ${dayString(latest.effectiveFrom)}`);
        }

        const ids = dto.components.map(c => c.componentId);
        if (new Set(ids).size !== ids.length) throw payrollErrors.profileDateInvalid("A component can only be listed once");
        const found = await d.payComponentRepository.findByIds(ids);
        for (const c of dto.components) {
            const comp = found.find(f => f.id === c.componentId);
            if (!comp) throw payrollErrors.refNotFound("A pay component");
            if (!comp.isActive) throw payrollErrors.componentInactive(comp.name);
            if (comp.calcType === "BANDED" && c.valueOverride !== undefined) throw payrollErrors.overrideNotAllowed(comp.name);
            if (c.valueOverride !== undefined && comp.calcType !== "FIXED" && c.valueOverride > 10000n) throw payrollErrors.componentInvalid(`A percentage is entered in basis points, from 0 to 10000 (${comp.name})`);
        }

        const created = await d.payProfileRepository.createFrom({
            staffId: dto.staffId, effectiveFrom: parseDay(dto.effectiveFrom), basicSalaryKobo: dto.basicSalaryKobo,
            bankCode: dto.bankCode ?? null, bankName: dto.bankName ?? null, accountName: dto.accountName ?? null,
            accountNumberEncrypted: dto.accountNumber ? d.encryptionService.encrypt(dto.accountNumber) : null, accountNumberLast4: dto.accountNumber ? dto.accountNumber.slice(-4) : null,
            taxId: dto.taxId ?? null, pensionId: dto.pensionId ?? null, createdById: actorUserId,
            components: dto.components.map(c => ({ componentId: c.componentId, valueOverride: c.valueOverride ?? null })),
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.profile.set", entity: "StaffPayProfile", entityId: created.id,
            newValue: { staffId: dto.staffId, effectiveFrom: dto.effectiveFrom, components: ids.length, previous: latest?.id ?? null },
        });
        return d.profileMapper.toResponse(created);
    }
}

export class GetPayProfileUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: PayrollOptions = {}) { this.now = options.now ?? (() => new Date()); }

    /* The profile in force today, and the dated history behind it. */
    async execute(staffId: string) {
        const history = await this.d.payProfileRepository.history(staffId);
        if (history.length === 0) throw payrollErrors.profileNotFound();
        const today = parseDay(todayInFinanceZone(this.now()));
        const current = history.find(p => p.isActive && p.effectiveFrom <= today && (p.effectiveTo === null || p.effectiveTo >= today)) ?? null;
        return { current: current ? this.d.profileMapper.toResponse(current) : null, history: history.map(p => this.d.profileMapper.toResponse(p)) };
    }
}

export class ListPayProfilesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(page?: number, limit?: number) {
        const r = await this.d.payProfileRepository.list(page, limit);
        const info = new Map((await this.d.payrollContextRepository.staffInfo(r.data.map(p => p.staffId))).map(s => [s.id, s.name]));
        return { data: r.data.map(p => ({ ...this.d.profileMapper.toResponse(p), staffName: info.get(p.staffId) ?? null })), meta: r.meta };
    }
}
