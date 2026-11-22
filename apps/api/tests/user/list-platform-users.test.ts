import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../../../../packages/contracts/src";
import { ListPlatformUsersUseCase } from "../../src/modules/user/usecases/list-platform-users.usecase";
import { ListPlatformUsersQuery } from "../../src/modules/user/dtos/user.dto";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";

const parse = (q: Record<string, unknown> = {}) => ListPlatformUsersQuery.parse(q);
const run = (q: Record<string, unknown>, total = 45) => {
    const seen: any[] = [];
    const uc = new ListPlatformUsersUseCase({ userDirectoryRepository: { list: async (f: any) => { seen.push(f); return { rows: [], total }; } } as any });
    return uc.execute(parse(q)).then(r => ({ ...r, filters: seen[0] }));
};

describe("GET /users: query", () => {
    it("defaults: page 1, 20 per page, newest first; limit capped at 100", () => {
        const q = parse();
        assert.deepEqual([q.page, q.limit, q.sort, q.order], [1, 20, "createdAt", undefined]);
        assert.throws(() => parse({ limit: "101" })); assert.throws(() => parse({ page: "0" }));
    });
    it('"false" means false (not true), and junk is refused', () => {
        const q = parse({ isActive: "false", platformMember: "true" });
        assert.equal(q.isActive, false); assert.equal(q.platformMember, true);
        assert.throws(() => parse({ isActive: "yes" }));
        assert.throws(() => parse({ sort: "passwordHash" }));
        assert.throws(() => parse({ search: "x".repeat(101) }));
    });
    it("the shared schema and the API schema accept and refuse the same inputs", () => {
        const samples = [{}, { page: "2", limit: "50" }, { limit: "500" }, { isActive: "false" }, { isActive: "no" }, { sort: "email", order: "asc" }, { sort: "role" }, { order: "up" }, { search: " ada " }, { schoolId: "" }, { platformMember: "true", schoolId: "s1" }];
        assert.deepEqual(samples.filter(s => C.ListPlatformUsersQuery.safeParse(s).success !== ListPlatformUsersQuery.safeParse(s).success), []);
    });
});

describe("GET /users: use case", () => {
    it("builds the pagination meta, including a last page and an empty result", async () => {
        assert.deepEqual((await run({ page: "1", limit: "20" }, 45)).meta, { total: 45, page: 1, limit: 20, totalPages: 3, hasNext: true, hasPrev: false });
        assert.deepEqual((await run({ page: "3", limit: "20" }, 45)).meta, { total: 45, page: 3, limit: 20, totalPages: 3, hasNext: false, hasPrev: true });
        assert.deepEqual((await run({}, 0)).meta, { total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false });
    });
    it("passes the filters through; email sorts ascending by default, everything else newest-first, an explicit order wins", async () => {
        const f = (await run({ search: " ada obi ", schoolId: "s1", isActive: "true", platformMember: "false", sort: "lastLoginAt" })).filters;
        assert.deepEqual([f.search, f.schoolId, f.isActive, f.platformMember, f.sort, f.order, f.page, f.limit], ["ada obi", "s1", true, false, "lastLoginAt", "desc", 1, 20]);
        assert.equal((await run({ sort: "email" })).filters.order, "asc");
        assert.equal((await run({ sort: "email", order: "desc" })).filters.order, "desc");
    });
    it("an empty search is no search", async () => assert.equal((await run({ search: "   " })).filters.search, undefined));
});

describe("platform.users.view permission", () => {
    const view = PERMISSION_REGISTRY.find(p => p.key === "platform.users.view");
    it("is a platform-realm, read-only, ALL-scope permission separate from manage", () => {
        assert.ok(view);
        assert.equal(view!.realm, "PLATFORM"); assert.deepEqual([...view!.scopes], ["ALL"]); assert.equal(view!.isSensitive, false);
        assert.ok(PERMISSION_REGISTRY.find(p => p.key === "platform.users.manage"));
    });
});

describe("GET /users: route guards (static check of the route file)", () => {
    const src = readFileSync("src/modules/user/routes/user.routes.ts", "utf8");
    const line = (re: RegExp) => src.split("\n").find(l => re.test(l)) ?? "";
    it("the list and the detail need platform.users.view; every write still needs platform.users.manage", () => {
        assert.match(line(/router\.get\("\/",/), /requirePermission\("platform\.users\.view"\)/);
        assert.match(line(/router\.get\("\/:id",/), /requirePermission\("platform\.users\.view"\)/);
        assert.doesNotMatch(line(/router\.get\("\/:id",/), /platform\.users\.manage/);
        for (const re of [/"\/:id\/deactivate"/, /"\/:id\/reactivate"/, /admin\/reset-password/]) assert.match(src.slice(src.search(re), src.search(re) + 260), /platform\.users\.manage/);
        assert.doesNotMatch(src, /platform\.users\.view[^\n]*(deactivate|reactivate)/);
    });
});

describe("the directory repository stays in the public database", () => {
    it("reads User, UserSchool and PlatformMember only: no tenant client, no legacy role/schoolId columns", () => {
        const src = readFileSync("src/modules/user/repositories/user-directory.repository.impl.ts", "utf8");
        assert.doesNotMatch(src, /getTenantClient|tenant/i);
        assert.doesNotMatch(src, /passwordHash|\brole:\s*true|schoolId:\s*true/);
        assert.match(src, /schools:\s*{\s*some:\s*{\s*schoolId/);
    });
});
