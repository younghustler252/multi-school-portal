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
    | Use cases ask repositories for data; they never open the database client themselves. The one thing they may take
    | from that file is `withTenantTransaction`, the "all or nothing" wrapper: every query inside it still goes through a repository.
    */
    it("use cases do not import the database client (only the withTenantTransaction wrapper is allowed)", () => {
        const offenders: string[] = [];
        for (const f of FILES.filter(f => /\/modules\/[^/]+\/usecases\//.test(f))) {
            for (const m of code(f).matchAll(/\{([^{}]*)\}\s*(?:=\s*await\s*import\(|from\s*)["'][^"']*prisma\.client["']/g)) {
                const names = m[1].split(",").map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                if (names.some(n => n !== "withTenantTransaction")) offenders.push(`${rel(f)} (${names.join(", ")})`);
            }
        }
        assert.deepEqual(offenders, [], "these use cases import the database client; add a repository method instead");
    });
});
