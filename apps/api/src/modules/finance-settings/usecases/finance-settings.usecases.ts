import { IFinanceSettingsRepository } from "../repositories/finance-settings.repository";
import { AuditService } from "../../audit/services/audit.service";
import { FINANCE_SETTING_BY_KEY, SettingValue, describeSettings, validateSettingValue } from "../domain/finance-settings";
import { financeSettingsErrors } from "../domain/finance-settings.errors";
import { UpdateFinanceSettingsDtoType } from "../dtos/finance-settings.dto";

interface Dependencies { financeSettingsRepository: IFinanceSettingsRepository; auditService: AuditService }
interface Options { transaction?: <T>(fn: () => Promise<T>) => Promise<T> }

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/* Every finance setting: what it means, what applies now, what the default is, and whether this school changed it. */
export class GetFinanceSettingsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute() {
        return { settings: describeSettings(await this.d.financeSettingsRepository.findOverrides()) };
    }
}

/*
| UPDATE one or several settings in one go, all or nothing. A value of null puts the setting back to its default.
| Everything is checked before anything is saved. The audit entry lists each real change (old and new value).
*/
export class UpdateFinanceSettingsUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: UpdateFinanceSettingsDtoType) {
        const entries = Object.entries(dto.values);
        const unknown = entries.map(([k]) => k).filter(k => !FINANCE_SETTING_BY_KEY.has(k));
        if (unknown.length) throw financeSettingsErrors.unknownKey(unknown);

        const problems: { key: string; message: string }[] = [];
        const writes: { key: string; value: SettingValue | null }[] = [];
        for (const [key, raw] of entries) {
            if (raw === null) { writes.push({ key, value: null }); continue; }
            const checked = validateSettingValue(FINANCE_SETTING_BY_KEY.get(key)!, raw);
            if (checked.ok) writes.push({ key, value: checked.value }); else problems.push({ key, message: checked.message });
        }
        if (problems.length) throw financeSettingsErrors.invalid(problems);

        const before = new Map(describeSettings(await this.d.financeSettingsRepository.findOverrides()).map(s => [s.key, s]));
        const changes = writes
            .map(w => ({ ...w, from: before.get(w.key)!.value, to: w.value === null ? before.get(w.key)!.default : w.value, wasOverridden: before.get(w.key)!.isOverridden }))
            .filter(c => (c.value === null ? c.wasOverridden : c.to !== c.from || !c.wasOverridden));

        if (changes.length) {
            await this.transaction(async () => {
                for (const c of changes) {
                    if (c.value === null) await this.d.financeSettingsRepository.remove(c.key);
                    else await this.d.financeSettingsRepository.set(c.key, c.value, actorUserId);
                }
            });
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "finance.settings.updated", entity: "SchoolSettingValue", entityId: "finance",
                newValue: { changes: changes.map(c => ({ key: c.key, from: c.from, to: c.to, reset: c.value === null })) },
            });
        }
        return { settings: describeSettings(await this.d.financeSettingsRepository.findOverrides()), changed: changes.map(c => c.key) };
    }
}
