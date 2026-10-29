import { ISchoolSettingValueRepository } from "../repositories/setting-value.repository";
import { AuditService } from "../../audit/services/audit.service";
import { SETTING_BY_KEY, SETTING_DEFS } from "../../../foundation/settings.registry";
import { SettingValue, describeSettings, validateSettingValue } from "../../../foundation/settings.engine";
import { schoolSettingsErrors } from "../domain/school-settings.errors";
import { UpdateSchoolPreferencesDtoType } from "../dtos/school-settings.dto";

interface Dependencies { schoolSettingValueRepository: ISchoolSettingValueRepository; auditService: AuditService }
interface Options { transaction?: <T>(fn: () => Promise<T>) => Promise<T> }

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

const KEYS = SETTING_DEFS.map(d => d.key);

/* Every school preference (messages, automation): what it means, what applies now, the default, and whether this school changed it. */
export class GetSchoolPreferencesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute() {
        return { settings: describeSettings(SETTING_DEFS, await this.d.schoolSettingValueRepository.findOverrides(KEYS)) };
    }
}

/*
| UPDATE one or several preferences in one go, all or nothing. A value of null puts the preference back to its default.
| Everything is checked before anything is saved. The audit entry lists each real change (old and new value).
*/
export class UpdateSchoolPreferencesUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: UpdateSchoolPreferencesDtoType) {
        const entries = Object.entries(dto.values);
        const unknown = entries.map(([k]) => k).filter(k => !SETTING_BY_KEY.has(k));
        if (unknown.length) throw schoolSettingsErrors.unknownKey(unknown);

        const problems: { key: string; message: string }[] = [];
        const writes: { key: string; value: SettingValue | null }[] = [];
        for (const [key, raw] of entries) {
            if (raw === null) { writes.push({ key, value: null }); continue; }
            const checked = validateSettingValue(SETTING_BY_KEY.get(key)!, raw);
            if (checked.ok) writes.push({ key, value: checked.value }); else problems.push({ key, message: checked.message });
        }
        if (problems.length) throw schoolSettingsErrors.invalid(problems);

        const before = new Map(describeSettings(SETTING_DEFS, await this.d.schoolSettingValueRepository.findOverrides(KEYS)).map(s => [s.key, s]));
        const changes = writes
            .map(w => ({ ...w, from: before.get(w.key)!.value, to: w.value === null ? before.get(w.key)!.default : w.value, wasOverridden: before.get(w.key)!.isOverridden }))
            .filter(c => (c.value === null ? c.wasOverridden : c.to !== c.from || !c.wasOverridden));

        if (changes.length) {
            await this.transaction(async () => {
                for (const c of changes) {
                    if (c.value === null) await this.d.schoolSettingValueRepository.remove(c.key);
                    else await this.d.schoolSettingValueRepository.set(c.key, c.value, actorUserId);
                }
            });
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "school_settings.preferences_updated", entity: "SchoolSettingValue", entityId: "preferences",
                newValue: { changes: changes.map(c => ({ key: c.key, from: c.from, to: c.to, reset: c.value === null })) },
            });
        }
        return { settings: describeSettings(SETTING_DEFS, await this.d.schoolSettingValueRepository.findOverrides(KEYS)), changed: changes.map(c => c.key) };
    }
}
