import { z } from "zod";

/*
| { "values": { "finance.allow_self_approval": false, "finance.grace_days": 7, "finance.budget_enforcement": null } }
| null puts a setting back to its default. Which keys exist and which values are allowed is checked by the use case,
| against the registry in domain/finance-settings.ts, so the error can name the setting.
*/
export const UpdateFinanceSettingsDto = z.object({
    values: z.record(z.string().min(1).max(100), z.union([z.boolean(), z.number(), z.string().max(50), z.null()]))
        .refine(v => { const n = Object.keys(v).length; return n >= 1 && n <= 20; }, "Send between 1 and 20 settings"),
}).strict();

export type UpdateFinanceSettingsDtoType = z.infer<typeof UpdateFinanceSettingsDto>;
