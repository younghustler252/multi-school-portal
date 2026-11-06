import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/* Rules the whole codebase keeps. They read the source files only (no database, no installed packages needed). */
const SRC = join(process.cwd(), "src");
function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== "generated" && name !== "node_modules") walk(p, out); }
        else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}
const FILES = walk(SRC);
const code = (f: string) => readFileSync(f, "utf8").split("\n").filter(l => { const s = l.trim(); return !(s.startsWith("//") || s.startsWith("/*") || s.startsWith("*") || s.startsWith("|")); }).join("\n");
const rel = (f: string) => f.slice(process.cwd().length + 1);

describe("architecture rules", () => {
    it("every relative import points at a file that exists", () => {
        const broken: string[] = [];
        for (const f of FILES) {
            for (const m of readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
                const target = resolve(dirname(f), m[1]);
                const ok = [".ts", ".tsx", ".d.ts", ".js", ".cjs", ".json", "/index.ts", "/index.js"].some(ext => existsSync(target + ext)) || (existsSync(target) && statSync(target).isFile());
                if (!ok) broken.push(`${rel(f)} -> ${m[1]}`);
            }
        }
        assert.deepEqual(broken, [], "imports that do not resolve");
    });

    it("authority is a permission, never a role name: the old role guards and req.user are gone", () => {
        const offenders: string[] = [];
        for (const f of FILES) {
            const c = code(f);
            if (/\brequire(SuperAdmin|SchoolAdmin|Staff|Roles|SameSchool)\b/.test(c) || /\breq\.user\b/.test(c) || /\blegacyRole\b/.test(c)) offenders.push(rel(f));
        }
        assert.deepEqual(offenders, []);
    });

    it("platform routes are guarded by platform permissions (keys start with platform.)", () => {
        const bad: string[] = [];
        for (const f of FILES.filter(x => /\.platform\.routes?\.ts$/.test(x))) {
            for (const m of readFileSync(f, "utf8").matchAll(/requirePermission\(\s*["']([^"']+)["']/g)) if (!m[1].startsWith("platform.")) bad.push(`${rel(f)}: ${m[1]}`);
        }
        assert.deepEqual(bad, []);
    });

    it("controllers call use cases, never the database", () => {
        const offenders = FILES.filter(f => /\.controller\.ts$/.test(f) && /prisma\.client/.test(readFileSync(f, "utf8"))).map(rel);
        assert.deepEqual(offenders, [], "controllers must call use cases, not the database");
    });

    /*
    | Use cases ask repositories for data; they do not open the database client themselves. These modules still do
    | (money transactions that span several tables) and are being moved one at a time: REMOVE a file from this list when
    | it is converted. A file NOT on the list that imports the client fails the build, so the list can only shrink.
    */
    it("use cases do not import the database client (except the modules still waiting to be converted)", () => {
        const WAITING = new Set([
        "src/modules/bank-reconciliation/usecases/reconciliation-shared.ts",
        "src/modules/expenses/usecases/expense-shared.ts",
        "src/modules/expenses/usecases/recurring.usecases.ts",
        "src/modules/fees/usecases/fee-adjustment.usecases.ts",
        "src/modules/fees/usecases/invoice-issue.usecases.ts",
        "src/modules/finance-settings/usecases/finance-settings.usecases.ts",
        "src/modules/gateway-settlements/usecases/settlement.usecases.ts",
        "src/modules/ledger/usecases/ledger-integrity.usecases.ts",
        "src/modules/payments/usecases/credit.usecases.ts",
        "src/modules/payments/usecases/payment-record.usecases.ts",
        "src/modules/payments/usecases/payment-reverse.usecase.ts",
        "src/modules/payments/usecases/refund.usecases.ts",
        "src/modules/payroll-transfers/usecases/transfer-outcome.service.ts",
        "src/modules/payroll-transfers/usecases/transfer.usecases.ts",
        "src/modules/payroll/usecases/payroll-shared.ts",
        ]);
        const offenders = FILES.filter(f => /\/modules\/[^/]+\/usecases\//.test(f) && /prisma\.client/.test(code(f)) && !WAITING.has(rel(f)));
        assert.deepEqual(offenders.map(rel), [], "these use cases import the database client; add a repository method instead");
        const stale = [...WAITING].filter(f => existsSync(join(process.cwd(), f)) && !/prisma\.client/.test(code(join(process.cwd(), f))));
        assert.deepEqual(stale, [], "these are converted already: remove them from the waiting list");
    });
});
