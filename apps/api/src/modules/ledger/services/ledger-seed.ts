import { randomUUID } from "crypto";
import {
    DEFAULT_FISCAL_YEAR_START_MONTH, MONEY_SUBTYPES, REQUIRED_SYSTEM_KEYS,
} from "../domain/ledger.constants";
import { monthlyPeriods } from "../domain/ledger.dates";
import type { LedgerTemplateRow } from "../ledger.templates";

/*
|--------------------------------------------------------------------------
| LEDGER PROVISIONING (what a brand-new school gets for its books)
|
|  1. its own chart of accounts, copied from the platform's account templates
|     (system accounts come out locked; money accounts are flagged so the cash book can find them)
|  2. its accounting months for the current fiscal year, all OPEN
|
| Runs inside the provisioning worker's transaction on the school's own schema, so a school is built
| completely or not at all. Later years' months are created on demand by the posting service.
|
| SAFE TO RUN AGAIN: it first reads what the school already has and only adds what is missing.
|   - an account that is already there with the same code and system role is left exactly as it is (no overwrite)
|   - a system account that already lives under another code keeps that code, so existing postings and mappings stay valid
|   - a code that is taken by a DIFFERENT account is an error (it names the code), never a silent skip or merge
|   - a month that already exists is left alone
|--------------------------------------------------------------------------
*/

// The one database call the seed needs: the worker's pg client satisfies it, and so does a test double
export interface SqlClient { query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, any>> }> }

// A database row (null for "none") or a registry entry (missing for "none") both fit
export type AccountTemplateInput = Pick<LedgerTemplateRow, "code" | "name" | "type" | "subtype" | "isSystem" | "sortOrder"> & {
    systemKey?:  string | null;
    parentCode?: string | null;
};

// The one call the loader needs (the real public Prisma client satisfies it)
export interface LedgerTemplateReader {
    ledgerAccountTemplate: {
        findMany(args: {
            where:   { isActive: boolean };
            orderBy: Array<{ sortOrder: "asc" } | { code: "asc" }>;
        }): Promise<AccountTemplateInput[]>;
    };
}

/** The active account templates, in display order. */
export const loadLedgerAccountTemplates = (db: LedgerTemplateReader): Promise<AccountTemplateInput[]> =>
    db.ledgerAccountTemplate.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });

/* ── Accounts ─────────────────────────────────────────────────────────── */

// Parents first (a child row needs its parent to exist). Fails clearly on a missing parent or a loop.
function parentsFirst(templates: AccountTemplateInput[]): AccountTemplateInput[] {
    const byCode  = new Map(templates.map(t => [t.code, t]));
    const done    = new Set<string>();
    const visiting = new Set<string>();
    const ordered: AccountTemplateInput[] = [];

    const visit = (t: AccountTemplateInput): void => {
        if (done.has(t.code)) return;
        if (visiting.has(t.code)) throw new Error(`Account templates form a loop at ${t.code}.`);
        visiting.add(t.code);
        if (t.parentCode) {
            const parent = byCode.get(t.parentCode);
            if (!parent) throw new Error(`Account template ${t.code} has parent ${t.parentCode}, which does not exist or is switched off.`);
            visit(parent);
        }
        visiting.delete(t.code);
        done.add(t.code);
        ordered.push(t);
    };

    templates.forEach(visit);
    return ordered;
}

export interface FinanceSeedOptions {
    today?:                Date;
    fiscalYearStartMonth?: number;
}

/**
 * Builds a new school's books: chart of accounts plus this fiscal year's months.
 * Refuses to run when a system account template is missing (run `npm run sync:registries` first),
 * because the posting rules could not work without them.
 */
export async function seedFinanceBooks(
    client:    SqlClient,
    templates: AccountTemplateInput[],
    options:   FinanceSeedOptions = {},
): Promise<{ accounts: number; periods: number; alreadyThere: number }> {
    const present = new Set(templates.map(t => t.systemKey).filter((k): k is string => Boolean(k)));
    const missing = REQUIRED_SYSTEM_KEYS.filter(k => !present.has(k));
    if (missing.length) {
        throw new Error(
            `The ledger account templates are missing system accounts: ${missing.join(", ")}. ` +
            `Run "npm run sync:registries" before provisioning schools.`,
        );
    }

    const ordered = parentsFirst(templates);

    // What the school already has (empty on a brand-new school)
    const have = (await client.query(`SELECT id, code, "systemKey" FROM "LedgerAccount"`)).rows;
    const byCode = new Map(have.map(r => [String(r.code), r]));
    const byKey  = new Map(have.filter(r => r.systemKey).map(r => [String(r.systemKey), r]));

    // Pass 1 (reads only): decide what to do with every template, so a real conflict stops us BEFORE anything is written
    const idByCode = new Map<string, string>();      // template code -> id of the account standing for it (existing or new)
    const toInsert: { id: string; t: AccountTemplateInput }[] = [];
    for (const t of ordered) {
        const sameCode = byCode.get(t.code);
        const sameRole = t.systemKey ? byKey.get(t.systemKey) : undefined;

        // Already there under this code with the same role: leave it exactly as it is
        if (sameCode && (sameCode.systemKey ?? null) === (t.systemKey ?? null)) { idByCode.set(t.code, String(sameCode.id)); continue; }
        // The system role already exists (under this or another code): keep that account, so postings and mappings stay valid
        if (sameRole) { idByCode.set(t.code, String(sameRole.id)); continue; }
        // Otherwise we would insert, and the code is taken by a different account: stop and say so
        if (sameCode) {
            throw new Error(
                `Ledger account code ${t.code} is already used in this school by a different account ` +
                `(system role ${sameCode.systemKey ?? "none"}, the template says ${t.systemKey ?? "none"}). Resolve it by hand; nothing was written.`,
            );
        }
        const id = randomUUID();
        idByCode.set(t.code, id);
        toInsert.push({ id, t });
    }

    // Pass 2: write only what is missing (parents come first, so a child's parentId already exists)
    for (const { id, t } of toInsert) {
        await client.query(
            `INSERT INTO "LedgerAccount"
               (id, code, name, type, subtype, "systemKey", "parentId", "isMoneyAccount", "isLocked", "sortOrder", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4::"LedgerAccountType", $5, $6, $7, $8, $9, $10, now(), now())`,
            [
                id, t.code, t.name, t.type, t.subtype, t.systemKey ?? null,
                t.parentCode ? idByCode.get(t.parentCode) : null,
                MONEY_SUBTYPES.has(t.subtype), t.isSystem, t.sortOrder,
            ],
        );
    }
    const added = toInsert.length;

    const periods = monthlyPeriods(options.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH, options.today ?? new Date());
    const existingMonths = (await client.query(`SELECT "startDate"::text AS "startDate", name FROM "FinancePeriod"`)).rows;
    const haveStart = new Set(existingMonths.map(r => String(r.startDate).slice(0, 10)));
    const haveName  = new Set(existingMonths.map(r => String(r.name)));
    let addedPeriods = 0;
    for (const p of periods) {
        if (haveStart.has(String(p.startDate).slice(0, 10)) || haveName.has(p.name)) continue;
        await client.query(
            `INSERT INTO "FinancePeriod" (id, name, "startDate", "endDate", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3::date, $4::date, 'OPEN'::"PeriodStatus", now(), now())`,
            [randomUUID(), p.name, p.startDate, p.endDate],
        );
        addedPeriods++;
    }

    return { accounts: added, periods: addedPeriods, alreadyThere: ordered.length - added };
}
