import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IFinanceSettingsRepository } from "./finance-settings.repository";

/*
| The school's overrides live in the tenant table SchoolSettingValue (one row per key, shared with the other settings).
| Not a table repository: the table has no mapper and no soft delete, so this does not extend the base class.
| It uses the tenant client, which is the open transaction when there is one.
*/
export class FinanceSettingsRepositoryImpl implements IFinanceSettingsRepository {
    private get db() { return getTenantClient(); }

    async findOverrides(): Promise<Record<string, unknown>> {
        const rows = await this.db.schoolSettingValue.findMany({ where: { key: { startsWith: "finance." } } });
        return Object.fromEntries(rows.map(r => [r.key, r.value]));
    }

    async set(key: string, value: boolean | number | string, userId: string): Promise<void> {
        await this.db.schoolSettingValue.upsert({
            where: { key },
            create: { key, value, updatedById: userId },
            update: { value, updatedById: userId },
        });
    }

    async remove(key: string): Promise<void> {
        await this.db.schoolSettingValue.deleteMany({ where: { key } });
    }
}
