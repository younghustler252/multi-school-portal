import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/* Every *.platform.routes.ts file must be mounted under /platform/* in routes/index.ts (an unmounted router is silently unreachable). */
const modulesDir = join(__dirname, "../../src/modules");
const index = readFileSync(join(__dirname, "../../src/routes/index.ts"), "utf8")
    .split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

test("every platform router file is imported and mounted under /platform", () => {
    const missing: string[] = [];
    for (const mod of readdirSync(modulesDir)) {
        const dir = join(modulesDir, mod, "routes");
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir).filter(x => x.endsWith(".platform.routes.ts"))) {
            if (!index.includes(`${mod}/routes/${f.replace(/\.ts$/, "")}`)) missing.push(`${mod}/${f}`);
        }
    }
    assert.deepEqual(missing, []);
    assert.equal((index.match(/router\.use\("\/platform\//g) ?? []).length >= 4, true);
});
