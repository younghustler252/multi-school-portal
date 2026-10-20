import { randomUUID } from "crypto";
import {
    DEFAULT_FISCAL_YEAR_START_MONTH, MONEY_SUBTYPES, REQUIRED_SYSTEM_KEYS,
} from "./ledger.constants";
import type { LedgerTemplateRow } from "./ledger.templates";

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

/* ── Periods ──────────────────────────────────────────────────────────── */

export interface PeriodDraft { name: string; startDate: string; endDate: string }

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * The 12 accounting months of the fiscal year that contains `today`.
 * Fiscal year starting in month 1 (January) and today in October 2026: 2026-01 ... 2026-12.
 * Starting in month 9 (September), today October 2026: 2026-09 ... 2027-08; today March 2026: 2025-09 ... 2026-08.
 * Dates are plain calendar dates ("2026-10-31"), so there is no time zone to go wrong.
 */
export function monthlyPeriods(fiscalYearStartMonth: number, today: Date): PeriodDraft[] {
    if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
        throw new Error(`The fiscal year start month must be a whole number from 1 to 12 (got ${fiscalYearStartMonth}).`);
    }

    const thisMonth = today.getUTCMonth() + 1;
    const startYear = thisMonth >= fiscalYearStartMonth ? today.getUTCFullYear() : today.getUTCFullYear() - 1;

    const periods: PeriodDraft[] = [];
    for (let i = 0; i < 12; i++) {
        const index = fiscalYearStartMonth - 1 + i;
        const year  = startYear + Math.floor(index / 12);
        const month = index % 12;                                   // 0 to 11
        periods.push({
            name:      `${year}-${pad(month + 1)}`,
            startDate: isoDate(new Date(Date.UTC(year, month, 1))),
            endDate:   isoDate(new Date(Date.UTC(year, month + 1, 0))),   // day 0 of next month = last day of this one
        });
    }
    return periods;
}

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
