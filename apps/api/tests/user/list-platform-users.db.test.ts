/*
| PLATFORM USER LIST, on a real database (public schema).
| Search, filters, sort, paging and the platform-operator block, against rows this file creates (unique tag in every email) and removes.
| Needs TEST_DATABASE_URL pointing at a test database whose public schema is migrated.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { dbTestsEnabled, skipReason } from "../helpers/test-database";
import { UserDirectoryRepositoryImpl } from "../../src/modules/user/repositories/user-directory.repository.impl";
import { ListPlatformUsersUseCase } from "../../src/modules/user/usecases/list-platform-users.usecase";
import { ListPlatformUsersQuery } from "../../src/modules/user/dtos/user.dto";

describe("platform user list (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const tag = `t${randomBytes(4).toString("hex")}`;
    let prisma: any; const ids: { users: string[]; schools: string[]; roles: string[] } = { users: [], schools: [], roles: [] };
    let U: Record<string, any>, A: any, B: any;
    const list = async (q: Record<string, unknown> = {}) =>
        new ListPlatformUsersUseCase({ userDirectoryRepository: new UserDirectoryRepositoryImpl({ prismaClient: prisma }) }).execute(ListPlatformUsersQuery.parse({ search: tag, limit: "100", ...q }));
    const emails = (r: { data: any[] }) => r.data.map(u => u.email.split("@")[0].replace(`${tag}-`, ""));

    before(async () => {
        ({ prisma } = await import("../../src/infrastructure/database/prisma/prisma.client"));
        const mk = async (key: string, o: Record<string, unknown> = {}) => {
            const u = await prisma.user.create({ data: { email: `${tag}-${key}@example.test`, passwordHash: "x", firstName: key, lastName: "Tester", ...o } });
            ids.users.push(u.id); return u;
        };
        U = {
            ada:   await mk("ada",   { firstName: "Ada", lastName: "Obi", lastLoginAt: new Date("2026-03-03T00:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z") }),
            bola:  await mk("bola",  { firstName: "Bola", lastName: "Eze", lastLoginAt: new Date("2026-02-02T00:00:00Z"), createdAt: new Date("2026-01-02T00:00:00Z"), isActive: false }),
            chidi: await mk("chidi", { firstName: "Chidi", lastName: "Obi", lastLoginAt: null, createdAt: new Date("2026-01-03T00:00:00Z") }),
            ops:   await mk("ops",   { firstName: "Ops", lastName: "Lead", createdAt: new Date("2026-01-04T00:00:00Z") }),
        };
        const school = async (k: string) => { const s = await prisma.school.create({ data: { name: `${tag} ${k}`, subdomain: `${tag}-${k}`, email: `${tag}-${k}@school.test` } }); ids.schools.push(s.id); return s; };
        A = await school("a"); B = await school("b");
        await prisma.userSchool.createMany({ data: [{ userId: U.ada.id, schoolId: A.id }, { userId: U.ada.id, schoolId: B.id }, { userId: U.bola.id, schoolId: A.id }, { userId: U.chidi.id, schoolId: B.id }] });
        const role = await prisma.platformRole.create({ data: { name: `${tag} Support`, kind: "CUSTOM" } }); ids.roles.push(role.id);
        const member = await prisma.platformMember.create({ data: { userId: U.ops.id } });
        await prisma.platformMemberRole.create({ data: { memberId: member.id, roleId: role.id } });
    });
    after(async () => {
        await prisma.userSchool.deleteMany({ where: { userId: { in: ids.users } } });
        await prisma.platformMember.deleteMany({ where: { userId: { in: ids.users } } });   // cascades member roles
        await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
        await prisma.platformRole.deleteMany({ where: { id: { in: ids.roles } } });
        await prisma.school.deleteMany({ where: { id: { in: ids.schools } } });
        await (await import("../../src/infrastructure/database/prisma/prisma.client")).disconnectPrisma();
    });

    it("search matches email, first or last name, case-insensitively, and every word must match", async () => {
        assert.deepEqual(emails(await list()).sort(), ["ada", "bola", "chidi", "ops"]);
        assert.deepEqual(emails(await list({ search: `${tag} OBI` })).sort(), ["ada", "chidi"]);
        assert.deepEqual(emails(await list({ search: `${tag} ada obi` })), ["ada"]);
        assert.deepEqual(emails(await list({ search: `${tag} nobody` })), []);
    });
    it("schoolId lists only that school's accounts and schoolCount counts all of an account's schools", async () => {
        const r = await list({ schoolId: A.id });
        assert.deepEqual(emails(r).sort(), ["ada", "bola"]);
        assert.equal(r.data.find(u => u.id === U.ada.id)!.schoolCount, 2);
        assert.equal((await list()).data.find(u => u.id === U.ops.id)!.schoolCount, 0);
    });
    it("isActive and platformMember filters; an operator carries its roles, an ordinary account has null", async () => {
        assert.deepEqual(emails(await list({ isActive: "false" })), ["bola"]);
        const ops = await list({ platformMember: "true" });
        assert.deepEqual(emails(ops), ["ops"]);
        assert.deepEqual(ops.data[0].platformMember!.roles.map(r => r.name), [`${tag} Support`]);
        assert.deepEqual(emails(await list({ platformMember: "false" })).sort(), ["ada", "bola", "chidi"]);
        assert.equal((await list()).data.find(u => u.id === U.ada.id)!.platformMember, null);
    });
    it("sorting: newest first by default, email ascending, last login with never-signed-in accounts last", async () => {
        assert.deepEqual(emails(await list()), ["ops", "chidi", "bola", "ada"]);
        assert.deepEqual(emails(await list({ sort: "email" })), ["ada", "bola", "chidi", "ops"]);
        const byLogin = emails(await list({ sort: "lastLoginAt", platformMember: "false" }));
        assert.deepEqual([byLogin[0], byLogin[1], byLogin[2]], ["ada", "bola", "chidi"]);
    });
    it("paging: pages do not overlap or skip, and meta is right", async () => {
        const p1 = await list({ limit: "3", page: "1" }), p2 = await list({ limit: "3", page: "2" });
        assert.deepEqual(p1.meta, { total: 4, page: 1, limit: 3, totalPages: 2, hasNext: true, hasPrev: false });
        assert.deepEqual(p2.meta, { total: 4, page: 2, limit: 3, totalPages: 2, hasNext: false, hasPrev: true });
        assert.deepEqual([...emails(p1), ...emails(p2)], ["ops", "chidi", "bola", "ada"]);
    });
    it("rows carry no password hash, role or schoolId field", async () => {
        const row = (await list()).data[0] as any;
        for (const k of ["passwordHash", "role", "schoolId", "phone", "lastLoginIp"]) assert.ok(!(k in row), k);
    });
});
