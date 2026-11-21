import { test } from "node:test";
import assert from "node:assert/strict";
import { platformUserWhere, platformUserView } from "../../src/modules/user/domain/platform-user-search";
import { ManagePlatformUsersUseCase } from "../../src/modules/user/usecases/manage-platform-users.usecase";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NOW = new Date("2026-11-21T10:00:00Z");

/* A tiny evaluator for the filter the repository sends, so the real predicate runs against rows. */
const get = (row: any, k: string) => row[k];
function ok(row: any, w: any): boolean {
    return Object.entries(w).every(([k, v]: [string, any]) => {
        if (k === "AND") return v.every((x: any) => ok(row, x));
        if (k === "OR") return v.some((x: any) => ok(row, x));
        if (k === "schools") return row.schools.some((s: string) => s === v.some.schoolId);
        if (k === "platformMember") return "isNot" in v ? row.platformMember : !row.platformMember;
        const x = get(row, k);
        if (v && typeof v === "object" && "contains" in v) return typeof x === "string" && x.toLowerCase().includes(v.contains.toLowerCase());
        if (v && typeof v === "object" && "gt" in v) return x instanceof Date && x > v.gt;
        return x === v;
    });
}
const U = (id: string, o: any = {}) => ({ id, email: id + "@x.com", firstName: "F" + id, lastName: "L" + id, isActive: true, isEmailVerified: true, lastLoginAt: null, createdAt: new Date("2026-01-01"), lockedUntil: null,
    schools: [], platformMember: false, ...o });
const DB = [
    U("ada", { firstName: "Ada", lastName: "Okafor", email: "ada.okafor@school-a.ng", schools: ["A"] }),
    U("bola", { firstName: "Bola", lastName: "Okafor", schools: ["A", "B"] }),
    U("chi", { firstName: "Chi", lastName: "Eze", isActive: false, schools: ["B"] }),
    U("dan", { firstName: "Dan", lastName: "Obi", lockedUntil: new Date("2026-11-21T11:00:00Z"), schools: ["A"] }),
    U("eve", { firstName: "Eve", lastName: "Staff", platformMember: true }),
    U("old", { firstName: "Old", lastName: "Lock", lockedUntil: new Date("2026-11-20T11:00:00Z") }),   // lock expired
];
const search = (f: any) => DB.filter(r => ok(r, platformUserWhere(f, NOW))).map(r => r.id);

test("no filters = everyone; search is case-insensitive over email, first and last name", () => {
    assert.equal(search({}).length, 6);
    assert.deepEqual(search({ q: "OKAFOR" }), ["ada", "bola"]);
    assert.deepEqual(search({ q: "school-a" }), ["ada"]);
    assert.deepEqual(search({ q: "  ada  " }), ["ada"]);
    assert.deepEqual(search({ q: "bola okafor" }), ["bola"]);           // two words: first + last name
    assert.deepEqual(search({ q: "zzz" }), []);
});

test("status, school and platform-staff filters, and they combine", () => {
    assert.deepEqual(search({ status: "inactive" }), ["chi"]);
    assert.deepEqual(search({ status: "locked" }), ["dan"]);             // an expired lock is not locked
    assert.deepEqual(search({ status: "active" }), ["ada", "bola", "dan", "eve", "old"]);
    assert.deepEqual(search({ schoolId: "B" }), ["bola", "chi"]);
    assert.deepEqual(search({ platformOnly: true }), ["eve"]);
    assert.equal(search({ platformOnly: false }).includes("eve"), false);
    assert.deepEqual(search({ schoolId: "A", q: "okafor", status: "active" }), ["ada", "bola"]);
});

test("a row never carries credentials, phone, IP or tokens; locked is computed from the lock time", () => {
    const v = platformUserView({ ...DB[3], schoolCount: 1, isPlatformMember: false } as any, NOW);
    assert.equal(v.isLocked, true);
    assert.deepEqual(Object.keys(v).sort(), ["createdAt", "email", "firstName", "id", "isActive", "isEmailVerified", "isLocked", "isPlatformMember", "lastLoginAt", "lastName", "schoolCount"]);
    assert.equal(platformUserView({ ...DB[5], schoolCount: 0, isPlatformMember: false } as any, NOW).isLocked, false);
});

test("the use case pages the result and returns the view", async () => {
    let seen: any;
    const uc = new ManagePlatformUsersUseCase({ userRepository: { searchForPlatform: async (w: any, page: number, limit: number) => { seen = { w, page, limit }; return { rows: DB.slice(0, 2).map(u => ({ ...u, schoolCount: u.schools.length, isPlatformMember: u.platformMember })), total: 45 }; } } } as any);
    const r = await uc.list({ q: "okafor", page: 2, limit: 20 } as any, NOW);
    assert.deepEqual([seen.page, seen.limit], [2, 20]);
    assert.deepEqual(r.meta, { total: 45, page: 2, limit: 20, totalPages: 3, hasNext: true, hasPrev: true });
    assert.equal(r.data.length, 2);
});

test("the list route is platform.users.manage only and registered before /:id", () => {
    const r = readFileSync(join(__dirname, "../../src/modules/user/routes/user.routes.ts"), "utf8");
    const list = r.indexOf('router.get("/", authenticate, requirePermission("platform.users.manage")');
    assert.ok(list > 0 && list < r.indexOf('router.get("/:id"'));
    const repo = readFileSync(join(__dirname, "../../src/modules/auth/repositories/user.repository.impl.ts"), "utf8");
    assert.doesNotMatch(repo.slice(repo.indexOf("searchForPlatform"), repo.indexOf("findByEmailWithPassword")), /passwordHash|phone|lastLoginIp/);
});
