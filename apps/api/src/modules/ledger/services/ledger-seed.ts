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
|--------------------------------------------------------------------------
*/

// The one database call the seed needs: the worker's pg client satisfies it, and so does a test double
export interface SqlClient { query(text: string, params?: unknown[]): Promise<unknown> }

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
): Promise<{ accounts: number; periods: number }> {
    const present = new Set(templates.map(t => t.systemKey).filter((k): k is string => Boolean(k)));
    const missing = REQUIRED_SYSTEM_KEYS.filter(k => !present.has(k));
    if (missing.length) {
        throw new Error(
            `The ledger account templates are missing system accounts: ${missing.join(", ")}. ` +
            `Run "npm run sync:registries" before provisioning schools.`,
        );
    }

    const ordered = parentsFirst(templates);
    const idByCode = new Map(ordered.map(t => [t.code, randomUUID()]));

    for (const t of ordered) {
        await client.query(
            `INSERT INTO "LedgerAccount"
               (id, code, name, type, subtype, "systemKey", "parentId", "isMoneyAccount", "isLocked", "sortOrder", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4::"LedgerAccountType", $5, $6, $7, $8, $9, $10, now(), now())`,
            [
                idByCode.get(t.code), t.code, t.name, t.type, t.subtype, t.systemKey ?? null,
                t.parentCode ? idByCode.get(t.parentCode) : null,
                MONEY_SUBTYPES.has(t.subtype), t.isSystem, t.sortOrder,
            ],
        );
    }

    const periods = monthlyPeriods(options.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH, options.today ?? new Date());
    for (const p of periods) {
        await client.query(
            `INSERT INTO "FinancePeriod" (id, name, "startDate", "endDate", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3::date, $4::date, 'OPEN'::"PeriodStatus", now(), now())`,
            [randomUUID(), p.name, p.startDate, p.endDate],
        );
    }

    return { accounts: ordered.length, periods: periods.length };
}
