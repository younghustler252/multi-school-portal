import { REQUIRED_SYSTEM_KEYS } from "./domain/ledger.constants";

/*
|--------------------------------------------------------------------------
| LEDGER ACCOUNT TEMPLATES (code registry: the first version of every school's chart of accounts)
|
| The same pattern as the role templates: this file supplies the starting data, the sync writes it into the
| public table LedgerAccountTemplate on every deploy, platform staff may adjust the editable rows without a
| deploy, and the provisioning worker copies the table into each new school.
|
|  SYSTEM rows (isSystem): the posting rules need them. The sync enforces their type, subtype and system key
|          on every deploy. They end up locked in the school (cannot be deleted or deactivated; renaming is fine).
|  EDITABLE rows: created once, then owned by the platform. The sync never overwrites them.
|
| Codes follow the usual order: 1xxx assets, 2xxx liabilities, 3xxx equity, 4xxx income, 5xxx expenses.
| A parent must be listed before its children and have the same type.
|--------------------------------------------------------------------------
*/

export type LedgerAccountTypeName = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface LedgerAccountTemplateDef {
    code:        string;
    name:        string;
    type:        LedgerAccountTypeName;
    subtype:     string;
    systemKey?:  string;
    parentCode?: string;
    isSystem:    boolean;
    sortOrder:   number;
}

type Draft = Omit<LedgerAccountTemplateDef, "sortOrder">;

const system = (code: string, name: string, type: LedgerAccountTypeName, subtype: string, systemKey: string): Draft =>
    ({ code, name, type, subtype, systemKey, isSystem: true });

const editable = (code: string, name: string, type: LedgerAccountTypeName): Draft =>
    ({ code, name, type, subtype: "GENERAL", isSystem: false });

const DRAFTS: Draft[] = [
    // ── Assets ──────────────────────────────────────────────────────────
    system("1000", "Cash on hand",                    "ASSET", "CASH",            "CASH_DEFAULT"),
    system("1010", "Main bank account",               "ASSET", "BANK",            "BANK_DEFAULT"),
    system("1020", "Petty cash",                      "ASSET", "PETTY_CASH",      "PETTY_CASH"),
    system("1030", "Online payments clearing",        "ASSET", "ONLINE_CLEARING", "ONLINE_CLEARING"),
    system("1100", "Fees receivable",                 "ASSET", "RECEIVABLE",      "FEES_RECEIVABLE"),
    system("1110", "Staff loans receivable",          "ASSET", "RECEIVABLE",      "STAFF_LOANS_RECEIVABLE"),

    // ── Liabilities ─────────────────────────────────────────────────────
    system("2000", "Accounts payable",                "LIABILITY", "PAYABLE",          "ACCOUNTS_PAYABLE"),
    system("2010", "Advance payments (parent credit)", "LIABILITY", "ADVANCE_PAYMENTS", "ADVANCE_PAYMENTS"),
    system("2100", "Salaries payable",                "LIABILITY", "PAYROLL_LIABILITY", "SALARIES_PAYABLE"),
    system("2110", "Staff tax payable",               "LIABILITY", "TAX_LIABILITY",     "TAX_PAYABLE"),
    system("2120", "Pension payable",                 "LIABILITY", "PAYROLL_LIABILITY", "PENSION_PAYABLE"),

    // ── Equity ──────────────────────────────────────────────────────────
    system("3000", "Opening balance equity",          "EQUITY", "OPENING_EQUITY", "OPENING_EQUITY"),

    // ── Income (editable) ───────────────────────────────────────────────
    editable("4000", "Tuition fees",           "INCOME"),
    editable("4010", "Admission fees",         "INCOME"),
    editable("4020", "Examination fees",       "INCOME"),
    editable("4030", "Books and materials",    "INCOME"),
    editable("4040", "Uniforms",               "INCOME"),
    editable("4050", "Transport",              "INCOME"),
    editable("4060", "Boarding",               "INCOME"),
    editable("4070", "Donations and grants",   "INCOME"),
    editable("4900", "Other income",           "INCOME"),

    // ── Expenses: the ones the posting rules need ───────────────────────
    system("5000", "Salaries and wages",                   "EXPENSE", "GENERAL",      "SALARIES_EXPENSE"),
    system("5010", "Employer pension contribution",        "EXPENSE", "GENERAL",      "EMPLOYER_PENSION_EXPENSE"),
    system("5020", "Discounts and scholarships allowed",   "EXPENSE", "DISCOUNTS",    "DISCOUNTS_ALLOWED"),   // contra to income
    system("5030", "Bad debt written off",                 "EXPENSE", "BAD_DEBT",     "BAD_DEBT"),
    system("5040", "Bank and gateway charges",             "EXPENSE", "BANK_CHARGES", "BANK_CHARGES"),

    // ── Expenses (editable) ─────────────────────────────────────────────
    editable("5100", "Utilities",                    "EXPENSE"),
    editable("5110", "Repairs and maintenance",      "EXPENSE"),
    editable("5120", "Teaching materials",           "EXPENSE"),
    editable("5130", "Office supplies",              "EXPENSE"),
    editable("5140", "Transport and fuel",           "EXPENSE"),
    editable("5150", "Security",                     "EXPENSE"),
    editable("5160", "Cleaning",                     "EXPENSE"),
    editable("5170", "Examinations expenses",        "EXPENSE"),
    editable("5180", "Events",                       "EXPENSE"),
    editable("5190", "Professional fees",            "EXPENSE"),
    editable("5200", "Rent",                         "EXPENSE"),
    editable("5210", "Internet and communications",  "EXPENSE"),
    editable("5900", "Other expenses",               "EXPENSE"),
];

// Ten apart, so platform staff can slot a new account between two existing ones
export const LEDGER_ACCOUNT_TEMPLATES: LedgerAccountTemplateDef[] =
    DRAFTS.map((d, i) => ({ ...d, sortOrder: i * 10 }));

/** Returns a list of problems; empty means the registry is valid. The sync refuses to write an invalid registry. */
export function validateLedgerAccountTemplates(defs: LedgerAccountTemplateDef[] = LEDGER_ACCOUNT_TEMPLATES): string[] {
    const problems: string[] = [];
    const byCode = new Map<string, LedgerAccountTemplateDef>();
    const seenKeys = new Set<string>();

    for (const d of defs) {
        if (!/^\d{4}$/.test(d.code)) problems.push(`${d.code}: code must be four digits`);
        if (!d.name.trim())          problems.push(`${d.code}: name is empty`);

        if (byCode.has(d.code)) problems.push(`${d.code}: defined more than once`);

        if (d.systemKey) {
            if (seenKeys.has(d.systemKey)) problems.push(`${d.code}: system key ${d.systemKey} is used twice`);
            seenKeys.add(d.systemKey);
        }
        if (d.isSystem && !d.systemKey)  problems.push(`${d.code}: a system account needs a system key`);
        if (!d.isSystem && d.systemKey)  problems.push(`${d.code}: only system accounts have a system key`);

        if (d.parentCode) {
            const parent = byCode.get(d.parentCode);        // only parents listed EARLIER are known here
            if (!parent)                    problems.push(`${d.code}: parent ${d.parentCode} must exist and be listed before it`);
            else if (parent.type !== d.type) problems.push(`${d.code}: parent ${d.parentCode} has a different type`);
        }
        byCode.set(d.code, d);
    }

    for (const key of REQUIRED_SYSTEM_KEYS) {
        if (!seenKeys.has(key)) problems.push(`system account ${key} is missing`);
    }
    for (const key of seenKeys) {
        if (!(REQUIRED_SYSTEM_KEYS as readonly string[]).includes(key)) problems.push(`unknown system key ${key} (add it to REQUIRED_SYSTEM_KEYS first)`);
    }
    return problems;
}

/* ── Sync ─────────────────────────────────────────────────────────────── */

export interface LedgerTemplateRow {
    id:         string;
    code:       string;
    name:       string;
    type:       string;
    subtype:    string;
    systemKey:  string | null;
    parentCode: string | null;
    isSystem:   boolean;
    isActive:   boolean;
    sortOrder:  number;
}

// The few database calls the sync needs (the real Prisma client satisfies this; tests use a small fake)
export interface LedgerTemplateDb {
    ledgerAccountTemplate: {
        findUnique(args: { where: { code: string } | { systemKey: string } }): Promise<LedgerTemplateRow | null>;
        create(args: { data: Omit<LedgerTemplateRow, "id"> }): Promise<unknown>;
        update(args: { where: { code: string }; data: Partial<Omit<LedgerTemplateRow, "id" | "code">> }): Promise<unknown>;
    };
}

export interface LedgerTemplateSyncReport { created: string[]; enforced: string[]; kept: string[]; conflicts: string[] }

/*
|--------------------------------------------------------------------------
| SYNC (run from sync-registries.ts on every deploy)
|  - new account         -> created
|  - SYSTEM account      -> its type, subtype, system key and active flag are enforced every deploy; wording is not
|  - editable account    -> created once, then never overwritten (the platform owns it)
| An invalid registry, or a system key already held by a different code, is reported as a conflict and nothing
| is written for it.
|--------------------------------------------------------------------------
*/
export async function syncLedgerAccountTemplates(
    db:   LedgerTemplateDb,
    defs: LedgerAccountTemplateDef[] = LEDGER_ACCOUNT_TEMPLATES,
): Promise<LedgerTemplateSyncReport> {
    const report: LedgerTemplateSyncReport = { created: [], enforced: [], kept: [], conflicts: [] };

    const problems = validateLedgerAccountTemplates(defs);
    if (problems.length) { report.conflicts.push(...problems); return report; }

    const table = db.ledgerAccountTemplate;

    for (const d of defs) {
        const row = await table.findUnique({ where: { code: d.code } });

        if (!row) {
            if (d.systemKey) {
                const holder = await table.findUnique({ where: { systemKey: d.systemKey } });
                if (holder) { report.conflicts.push(`${d.code}: system key ${d.systemKey} is already used by account ${holder.code}`); continue; }
            }
            await table.create({
                data: {
                    code: d.code, name: d.name, type: d.type, subtype: d.subtype, systemKey: d.systemKey ?? null,
                    parentCode: d.parentCode ?? null, isSystem: d.isSystem, isActive: true, sortOrder: d.sortOrder,
                },
            });
            report.created.push(d.code);
            continue;
        }

        if (!d.isSystem) { report.kept.push(d.code); continue; }

        const patch: Partial<Omit<LedgerTemplateRow, "id" | "code">> = {};
        if (row.type !== d.type)                  patch.type = d.type;
        if (row.subtype !== d.subtype)            patch.subtype = d.subtype;
        if ((row.systemKey ?? null) !== (d.systemKey ?? null)) patch.systemKey = d.systemKey ?? null;
        if (!row.isSystem)                        patch.isSystem = true;
        if (!row.isActive)                        patch.isActive = true;

        if (Object.keys(patch).length) { await table.update({ where: { code: d.code }, data: patch }); report.enforced.push(d.code); }
        else report.kept.push(d.code);
    }
    return report;
}
