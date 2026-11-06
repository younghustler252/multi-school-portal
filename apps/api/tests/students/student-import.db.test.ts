/*
| STUDENT IMPORT against a real database (a throwaway school with every tenant migration applied).
| Runs only when TEST_DATABASE_URL is set (the database name must contain "test"). Tests share one seeded school and run in order.
| (The plan-limit guard loads the app container, so Redis must be running.)
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { asValue } from "awilix";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { mainBranchId } from "../helpers/test-database";
import { PreviewStudentImportUseCase, ImportStudentsUseCase } from "../../src/modules/students/usecases/student-import.usecases";
import { StudentMapper } from "../../src/modules/students/mappers/student.mapper";
import { StudentRepositoryImpl } from "../../src/modules/students/repositories/student.repository.impl";
import { NumberSequenceService } from "../../src/shared/services/number-sequence.service";
import { IMPORT_TEMPLATE } from "../../src/modules/students/domain/student-import.policy";

const HEAD = "firstName,lastName,dateOfBirth,gender,admissionNumber,className,guardianFirstName,guardianLastName,guardianEmail,guardianPhone,guardianRelation";
const csv = (...lines: string[]) => Buffer.from([HEAD, ...lines].join("\r\n") + "\r\n", "utf8");

describe("student import (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; const audits: any[] = []; let S: any;
    const actor = { userId: "user-admin" } as any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const preview = (b: Buffer) => new PreviewStudentImportUseCase({ studentRepository: studentRepository() }).execute(school.schoolId, { buffer: b, name: "students.csv" });
    const studentRepository = () => new StudentRepositoryImpl({ studentMapper: new StudentMapper() } as any);
    const run = (b: Buffer) => new ImportStudentsUseCase({ studentRepository: studentRepository(), numberSequenceService: new NumberSequenceService(), auditService: { log: async (p: any) => { audits.push(p); } } } as any).execute(school.schoolId, { buffer: b, name: "students.csv" }, actor);
    const counts = async () => ({ students: await db().student.count(), enrolments: await db().enrolment.count(), guardians: await db().guardian.count(), links: await db().studentGuardian.count() });
    const limit = async (max: number | null) => {
        const { container } = await import("../../src/container"); const { tenantMeters } = await import("../../src/foundation/foundation.container");
        container.register({ entitlementsService: asValue({ checkLimit: async (_s: string, _k: string, adding: number) => {
            const current = await tenantMeters()["students.active"]();
            return max === null || current + adding <= max ? { allowed: true } : { allowed: false, reason: "limit_reached", limit: max, current };
        } }) });
    };

    before(async () => {
        school = await createTestSchool();
        S = await school.run(async () => {
            const d = db();
            const session = await d.session.create({ data: { name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true } });
            const term = await d.term.create({ data: { sessionId: session.id, name: "first", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-15"), isCurrent: true } });
            const branchId = await mainBranchId(d);
            const small = await d.class.create({ data: { name: "JSS 1A", branchId, capacity: 3 } });
            const big = await d.class.create({ data: { name: "JSS 2A", branchId } });
            const old = await d.student.create({ data: { firstName: "Efe", lastName: "Old", dateOfBirth: new Date("2013-05-05T00:00:00Z"), admissionNumber: "OLD/001" } });
            await d.enrolment.create({ data: { studentId: old.id, classId: big.id, termId: term.id, status: "active" } });
            const parent = await d.guardian.create({ data: { firstName: "Ola", lastName: "Old", email: "ola@x.com" } });
            await d.studentGuardian.create({ data: { guardianId: parent.id, studentId: old.id, relation: "father", isPrimary: true } });
            return { term, small, big, old, parent };
        });
        await limit(null);
    });
    after(async () => { await school.drop(); });

    const MIXED = () => csv(
        "Ada,Obi,25/03/2014,female,,JSS 2A,Ngozi,Obi,ngozi@x.com,08031234567,mother",     // ok, new parent
        "Bola,Obi,2015-07-01,m,,JSS 2A,Ngozi,Obi,NGOZI@x.com,,mother",                     // ok, SAME parent (sister/brother)
        "Chidi,Eze,12/01/2013,male,NEW/003,JSS 2A,Ola,Old,ola@x.com,,father",              // ok, parent already in the school
        "Efe,Old,05/05/2013,male,,JSS 2A,,,,,",                                            // duplicate of a student already in the school
        "Dayo,Ade,31/02/2014,male,,JSS 2A,,,,,",                                            // not a real date
        "Femi,Bello,01/02/2014,male,,JSS 9Z,,,,,",                                         // class does not exist
        ",Nameless,01/02/2014,male,,JSS 2A,,,,,",                                           // first name missing
        "Gina,Okoro,03/03/2014,female,NEW/003,JSS 2A,,,,,",                                // same admission number as row 4 in this file
    );

    it("the preview checks every row, says what is wrong, and saves nothing", () => school.run(async () => {
        const before = await counts();
        const r = await preview(MIXED());
        assert.deepEqual(r.summary, { total: 8, ok: 3, skipped: 2, errors: 3, willCreate: 3 });
        assert.deepEqual(r.rows.map(x => x.status), ["ok", "ok", "ok", "skipped", "error", "error", "error", "skipped"]);
        assert.match(r.rows[3].messages[0], /already in the school/);
        assert.match(r.rows[4].messages[0], /not a real date/);
        assert.match(r.rows[5].messages[0], /does not exist/);
        assert.match(r.rows[6].messages[0], /First name is required/);
        assert.match(r.rows[7].messages[0], /already used on row 4/);
        assert.equal(r.planLimit.allowed, true);
        assert.deepEqual(await counts(), before, "nothing was saved");
    }));

    it("the import saves the valid rows: numbers are generated, the class place is made, parents are shared, and it is audited", () => school.run(async () => {
        const r = await run(MIXED());
        assert.deepEqual(r.summary, { total: 8, created: 3, skipped: 2, errors: 3, guardiansCreated: 1, guardiansLinked: 2 });
        assert.deepEqual(r.rows.map(x => x.status), ["created", "created", "created", "skipped", "error", "error", "error", "skipped"]);
        const [ada, bola, chidi] = r.rows.slice(0, 3).map(x => x.student!);
        assert.ok(/^\d{4}\/\d{4}$/.test(ada.admissionNumber!) && ada.admissionNumber !== bola.admissionNumber, "generated and different");
        assert.equal(chidi.admissionNumber, "NEW/003", "a typed number is kept");
        const cls = await db().enrolment.findMany({ where: { studentId: { in: [ada.id, bola.id, chidi.id] } } });
        assert.equal(cls.length, 3); assert.ok(cls.every((e: any) => e.classId === S.big.id && e.termId === S.term.id && e.status === "active"));
        const a = await db().student.findUnique({ where: { id: ada.id } });
        assert.deepEqual([a.gender, a.dateOfBirth.toISOString().slice(0, 10), a.isActive], ["female", "2014-03-25", true]);
        // Ada and Bola share ONE new parent (email in different capitals); Chidi is linked to the parent who was already there
        assert.equal(await db().guardian.count({ where: { email: "ngozi@x.com" } }), 1);
        const links = await db().studentGuardian.findMany({ where: { studentId: { in: [ada.id, bola.id, chidi.id] } }, include: { guardian: true } });
        assert.deepEqual(links.map((l: any) => [l.guardian.email, l.relation, l.isPrimary]).sort(), [["ngozi@x.com", "mother", true], ["ngozi@x.com", "mother", true], ["ola@x.com", "father", true]]);
        assert.equal((await db().guardian.findFirst({ where: { email: "ngozi@x.com" } })).phone, "08031234567");
        assert.equal(await db().student.count({ where: { lastName: "Nameless" } }), 0);
        const au = audits.find(x => x.action === "student.bulk_imported");
        assert.deepEqual([au.newValue.created, au.newValue.skipped, au.newValue.errors, au.newValue.guardiansCreated], [3, 2, 3, 1]);
        assert.ok(au.newValue.students[0].startsWith("Ada Obi ("));
    }));

    it("uploading the same file again adds nothing: every student is recognised and skipped", () => school.run(async () => {
        const before = await counts();
        const r = await run(MIXED());
        assert.equal(r.summary.created, 0);
        assert.deepEqual(r.rows.map(x => x.status), ["skipped", "skipped", "skipped", "skipped", "error", "error", "error", "skipped"]);
        assert.deepEqual(await counts(), before);
    }));

    it("class capacity: the extra students are errors; a class that fills up stays full for the next file", () => school.run(async () => {
        const four = csv(...["A", "B", "C", "D"].map((n, i) => `${n},Cap,0${i + 1}/01/2014,female,,JSS 1A,,,,,`));
        const r = await run(four);
        assert.deepEqual(r.rows.map(x => x.status), ["created", "created", "created", "error"]);
        assert.match(r.rows[3].messages[0], /JSS 1A is full \(3 students\)/);
        assert.equal(await db().enrolment.count({ where: { classId: S.small.id } }), 3);
        const again = await run(csv("E,Cap,05/01/2014,female,,JSS 1A,,,,,"));
        assert.equal(again.rows[0].status, "error");
    }));

    it("the plan limit refuses the WHOLE import (nothing saved), and the preview shows how much room there is", () => school.run(async () => {
        const current = await db().student.count({ where: { isActive: true, graduatedAt: null } });
        await limit(current + 1);
        const file = csv("P,One,01/02/2012,male,,JSS 2A,,,,,", "Q,Two,02/02/2012,male,,JSS 2A,,,,,");
        const p = await preview(file);
        assert.deepEqual([p.planLimit.allowed, p.planLimit.adding, p.planLimit.limit, p.planLimit.current], [false, 2, current + 1, current]);
        assert.equal(p.summary.willCreate, 0);
        const before = await counts();
        await assert.rejects(() => run(file), (e: any) => e.code === "PLAN_LIMIT_REACHED");
        assert.deepEqual(await counts(), before);
        assert.equal((await run(csv("P,One,01/02/2012,male,,JSS 2A,,,,,"))).summary.created, 1, "one student fits");
        await limit(null);
    }));

    it("two people importing the same new students at the same moment: nothing is doubled and a loser changes nothing", () => school.run(async () => {
        const file = csv("R,One,,male,RACE/1,JSS 2A,Rita,One,rita@x.com,,mother", "S,Two,,female,RACE/2,JSS 2A,Rita,One,rita@x.com,,mother");
        const settled = await Promise.allSettled([school.run(() => run(file)), school.run(() => run(file))]);
        for (const x of settled) if (x.status === "rejected") assert.equal((x.reason as any).code, "IMPORT_CONFLICT");
        assert.ok(settled.some(x => x.status === "fulfilled"));
        assert.equal(await db().student.count({ where: { admissionNumber: { in: ["RACE/1", "RACE/2"] } } }), 2);
        assert.equal(await db().guardian.count({ where: { email: "rita@x.com" } }), 1);
        assert.equal(await db().studentGuardian.count({ where: { guardian: { email: "rita@x.com" } } }), 2);
    }));

    it("a bad file is refused with the reason: Excel, missing columns, empty, too many rows", () => school.run(async () => {
        const reason = async (b: Buffer) => { try { await preview(b); return "accepted"; } catch (e: any) { return e.code === "IMPORT_FILE_INVALID" ? e.details.reason : e.code; } };
        assert.equal(await reason(Buffer.from([0x50, 0x4b, 3, 4, 0])), "excel");
        assert.equal(await reason(Buffer.from("firstName\r\nAda\r\n")), "missing_columns");
        assert.equal(await reason(Buffer.from("")), "empty");
        assert.equal(await reason(Buffer.from("firstName,lastName\r\n" + "A,B\r\n".repeat(1001))), "too_many_rows");
        const t = await preview(Buffer.from(IMPORT_TEMPLATE));   // its example student (Ada Obi, 25/03/2014) was imported by an earlier test, so it is "skipped", never an error
        assert.deepEqual([t.summary.total, t.summary.errors], [1, 0], "the template itself is a valid file");
    }));
});
