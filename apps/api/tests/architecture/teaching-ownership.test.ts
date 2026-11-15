/*
| WHO OWNS WHAT: Staff is the employee record; Classes owns what a teacher leads and teaches.
| These rules read the source files only (no database). They keep the boundary from quietly eroding:
|   A. No module outside Classes re-writes the "leads / teaches a class" rule; they use Classes' teaching-access.
|   B. Staff holds no assignment logic: it never queries class tables or imports the Class repository. It asks the
|      Classes-owned reader.
|   C. Classes reads Staff only through the Staff repository interface (eligibility, names), nothing deeper.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODULES = join(process.cwd(), "src", "modules");
function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out); else if (/\.ts$/.test(name)) out.push(p);
    }
    return out;
}
const rel = (f: string) => f.slice(process.cwd().length + 1).replace(/\\/g, "/");
const inModule = (f: string, m: string) => rel(f).startsWith(`src/modules/${m}/`);
const stripComments = (s: string) => s.split("\n").filter(l => { const t = l.trim(); return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("|")); }).join("\n");
const FILES = walk(MODULES).map(f => ({ f, text: stripComments(readFileSync(f, "utf8")) }));

describe("teaching ownership: Staff is the employee record, Classes owns assignments", () => {
    it("A. nobody outside Classes writes its own 'leads / teaches' filter (use classes/services/teaching-access)", () => {
        const RULE_COPIES = [/classTeacherId:\s*(me|staffId|access\.personaEntityId)\b/, /classSubjects:\s*\{\s*some/, /\{\s*staffId:\s*me\s*\}/];
        const offenders = FILES.filter(({ f, text }) => !inModule(f, "classes") && RULE_COPIES.some(r => r.test(text))).map(x => rel(x.f));
        assert.deepEqual(offenders, [], "these rewrite the rule themselves; call teaching-access instead");
    });

    it("A. the modules that scope teachers by ASSIGNED really do use the Classes-owned definition", () => {
        for (const file of ["attendance/services/attendance-scope.ts", "enrolment/services/enrolment-scope.ts", "students/services/student-scope.ts", "grades/services/grades-scope.ts", "report-cards/services/report-card-scope.ts", "attendance/repositories/attendance.repository.ts"]) {
            const text = readFileSync(join(MODULES, file), "utf8");
            assert.match(text, /classes\/services\/teaching-access/, `${file} must use teaching-access`);
        }
    });

    it("B. Staff never queries class tables and never imports the Class repository", () => {
        const staff = FILES.filter(({ f }) => inModule(f, "staff"));
        const queries = staff.filter(({ text }) => /\b(prisma|db|tx)\.(class|classSubject)\b/.test(text)).map(x => rel(x.f));
        assert.deepEqual(queries, [], "Staff must ask Classes, not read its tables");
        const imports = staff.flatMap(({ f, text }) => [...text.matchAll(/from\s+["']([^"']*classes\/[^"']+)["']/g)].map(m => `${rel(f)} -> ${m[1]}`));
        for (const i of imports) assert.match(i, /classes\/services\/teaching-assignments\.reader$/, `Staff may only use the Classes-owned reader: ${i}`);
    });

    it("B. Staff keeps no assignment queries of its own (the count lives with Classes)", () => {
        const repo = readFileSync(join(MODULES, "staff/repositories/staff.repository.ts"), "utf8");
        assert.ok(!/countActiveAssignments/.test(repo));
    });

    it("C. Classes reads Staff only through the Staff repository interface", () => {
        const imports = FILES.filter(({ f }) => inModule(f, "classes")).flatMap(({ f, text }) => [...text.matchAll(/from\s+["']([^"']*\/staff\/[^"']+)["']/g)].map(m => `${rel(f)} -> ${m[1]}`));
        for (const i of imports) assert.match(i, /staff\/repositories\/staff\.repository$/, `Classes may only read the Staff repository interface: ${i}`);
    });
});
