/*
| FIND A STUDENT (students.lookup): the bursar's picker, on a real database.
| A short, searched list with name, admission number, class, branch and status. Never the record behind it.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed } from "../attendance/fixtures";
import { StudentRepositoryImpl } from "../../src/modules/students/repositories/student.repository.impl";
import { StudentMapper } from "../../src/modules/students/mappers/student.mapper";
import { LookupStudentsUseCase } from "../../src/modules/students/usecases/student-lookup.usecase";
import { LookupStudentsQuery } from "../../src/modules/students/dtos/student.dto";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { permissionByKey } from "../../src/foundation/permissions.registry";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SECRETS = ["1999-04-05", "O+", "12 Hidden Street", "Anglican", "Nigerian", "Kano", "08031234567", "ada.secret@example.com"];

describe("students.lookup (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let W: any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const find = (q: any) => school.run(() => new LookupStudentsUseCase({ studentRepository: new StudentRepositoryImpl({ studentMapper: new StudentMapper() } as any) } as any).execute(LookupStudentsQuery.parse(q)));

    before(async () => {
        school = await createTestSchool();
        W = await school.run(async () => {
            const S = await seed();                                    // s1 Ada, s2 Bola ... in JSS 1A for the current term
            const d = db();
            await d.student.update({ where: { id: S.s1.id }, data: { admissionNumber: "GF/2026/001", middleName: "Grace", dateOfBirth: new Date("1999-04-05"), gender: "female", bloodGroup: "O+", address: "12 Hidden Street", religion: "Anglican", nationality: "Nigerian", stateOfOrigin: "Kano" } });
            const left = await d.student.create({ data: { firstName: "Ada", lastName: "Leaver", branchId: S.s1.branchId, isActive: false } });
            const grad = await d.student.create({ data: { firstName: "Ada", lastName: "Graduate", branchId: S.s1.branchId, graduatedAt: new Date("2025-07-01"), graduatedTermId: S.term.id } });
            return { S, left, grad };
        });
    });
    after(async () => { await school.drop(); });

    it("returns only the picker fields: name, admission number, branch, class and status", async () => {
        const [ada] = await find({ search: "ada pupil" });
        assert.deepEqual(Object.keys(ada).sort(), ["admissionNumber", "branchId", "currentClass", "firstName", "id", "lastName", "middleName", "status"]);
        assert.equal(ada.id, W.S.s1.id); assert.equal(ada.admissionNumber, "GF/2026/001"); assert.equal(ada.status, "active"); assert.equal(ada.currentClass.name, "JSS 1A");
    });
    it("nothing from the record behind it leaks: no date of birth, gender, blood group, address, religion, nationality, state, photo, phone, email, guardians", async () => {
        const text = JSON.stringify(await find({ search: "ada" }));
        for (const secret of SECRETS) assert.ok(!text.includes(secret), `leaked ${secret}`);
        for (const key of ["dateOfBirth", "gender", "bloodGroup", "address", "religion", "nationality", "stateOfOrigin", "photoUrl", "userId", "guardians"]) assert.ok(!text.includes(`"${key}"`), `has ${key}`);
    });
    it("finds by admission number and by any word of the name, case does not matter", async () => {
        assert.equal((await find({ search: "gf/2026" }))[0].id, W.S.s1.id);
        assert.equal((await find({ search: "ADA grace" }))[0].id, W.S.s1.id);
    });
    it("a search is required and must be at least 2 letters (it cannot list everyone)", () => {
        for (const q of [{}, { search: "" }, { search: " " }, { search: "a" }]) assert.equal(LookupStudentsQuery.safeParse(q).success, false, JSON.stringify(q));
    });
    it("at most 25 come back, however many are asked for", () => {
        assert.equal(LookupStudentsQuery.safeParse({ search: "ad", limit: 26 }).success, false);
        assert.equal(LookupStudentsQuery.parse({ search: "ad" }).limit, 10);
    });
    it("only active students unless asked: inactive and graduated ones can be asked for (their accounts may still owe)", async () => {
        const names = async (status?: string) => (await find({ search: "ada", ...(status && { status }) })).map((s: any) => s.lastName).sort();
        assert.deepEqual(await names(), ["Pupil"]);
        assert.deepEqual(await names("inactive"), ["Leaver"]);
        assert.deepEqual(await names("graduated"), ["Graduate"]);
        assert.deepEqual(await names("all"), ["Graduate", "Leaver", "Pupil"]);
        const grad = (await find({ search: "ada", status: "graduated" }))[0]; assert.equal(grad.status, "graduated"); assert.equal(grad.currentClass, null);
    });
    it("a student not in a class this term shows no class (not an error)", async () => {
        const [left] = await find({ search: "leaver", status: "inactive" }); assert.equal(left.currentClass, null);
    });
});

describe("students.lookup: who holds it, and where the route sits", () => {
    const holders = ROLE_TEMPLATES.filter(t => t.permissions.some(p => p.key === "students.lookup")).map(t => t.key);
    it("is an ALL-scope, staff-only permission", () => {
        const def = permissionByKey("students.lookup") as any;
        assert.ok(def, "registered"); assert.deepEqual(def.scopes, ["ALL"]); assert.deepEqual(def.personas, ["STAFF"]);
    });
    it("the bursar has it; teachers, students and guardians do not (the school admin has everything)", () => {
        assert.deepEqual(holders, ["bursar"]);
    });
    it("for now the bursar keeps students.view too: removing it is a separate, later step", () => {
        assert.ok(ROLE_TEMPLATES.find(t => t.key === "bursar")!.permissions.some(p => p.key === "students.view"));
    });
    it("/students/lookup is registered BEFORE /students/:id, so it is never read as an id", () => {
        // read from the source: importing the router would start the whole container (and its Redis connection)
        const src = readFileSync(join(__dirname, "../../src/modules/students/routes/student.routes.ts"), "utf8");
        const at = (needle: string) => src.indexOf(needle);
        assert.ok(at('router.get("/lookup"') > 0 && at('router.get("/lookup"') < at('router.get("/:id"'));
        assert.match(src, /requirePermission\("students\.lookup"\)/);
    });
});
