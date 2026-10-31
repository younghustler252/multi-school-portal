import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/routes/index.ts", "utf8");
const active = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

describe("routes/index.ts wiring", () => {
    it("every router that is imported is also mounted (branches was imported but never mounted, so every /branches call was a 404)", () => {
        const imported = [...active.matchAll(/^import\s+(\w+)\s+from\s+["'][^"']*routes?[^"']*["']/gm)].map(m => m[1]).filter(n => /router$/i.test(n));
        assert.ok(imported.length > 10, "found the imports");
        const unmounted = imported.filter(n => !new RegExp(`router\\.use\\([^)]*\\b${n}\\b`).test(active));
        assert.deepEqual(unmounted, [], `imported but not mounted: ${unmounted.join(", ")}`);
    });
    it("branches is mounted at /branches", () => {
        assert.match(active, /router\.use\("\/branches",\s*branchRouter\)/);
    });
    it("two routers on one path is allowed (finance, fees, grades); the same path is never given to two different modules by accident", () => {
        const mounts = [...active.matchAll(/router\.use\("([^"]+)",\s*(\w+)\)/g)].map(m => [m[1], m[2]] as const);
        const shared = new Set(["/finance", "/fees", "/grades"]);
        const seen = new Map<string, string>();
        for (const [path, name] of mounts) {
            if (seen.has(path) && !shared.has(path)) assert.fail(`${path} is mounted twice (${seen.get(path)} and ${name})`);
            seen.set(path, name);
        }
    });
});
