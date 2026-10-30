import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isUniqueViolation, violatesColumn } from "../../src/shared/errors/unique-violation";
import { isGuardianEmailConflict } from "../../src/modules/guardians/domain/guardian.policy";
import { classWriteError, subjectWriteError } from "../../src/modules/classes/domain/class.conflicts";
import { CreateClassUseCase } from "../../src/modules/classes/usecases/school-admin/create-class.usecase";
import { CreateSessionUseCase } from "../../src/modules/sessions/usecases/session-commands.usecases";

// The shapes below are what Prisma gives through the Postgres adapter: only the column text, never the index name.
// (Read from the real Postgres message: Key (lower(btrim(name)))=(x), Key (code)=(M), Key ("sessionId", name)=(...).)
const adapterError = (fields: string[]) => ({
    code: "P2002",
    message: `Unique constraint failed on the fields: (${fields.map(f => "`" + f + "`").join(",")})`,
    meta: { driverAdapterError: { name: "DriverAdapterError", cause: { originalCode: "23505", kind: "UniqueConstraintViolation", constraint: { fields } } } },
});

describe("reading an adapter 'already exists' error", () => {
    it("finds the column in the real shapes, and only that column", () => {
        assert.equal(violatesColumn(adapterError(["code"]), "code"), true);
        assert.equal(violatesColumn(adapterError(["lower(btrim(name"]), "code"), false);
        assert.equal(violatesColumn(adapterError(["lower(email"]), "email"), true);
        assert.equal(violatesColumn(adapterError(["studentId", "guardianId"]), "email"), false);
        assert.equal(violatesColumn({ code: "P2025", message: "code" }, "code"), false);
        assert.equal(isUniqueViolation(new Error("x")), false);
    });
    it("guardian email rule is recognised from the real adapter shape (fix for the first version)", () => {
        assert.equal(isGuardianEmailConflict(adapterError(["lower(email"])), true);
        assert.equal(isGuardianEmailConflict(adapterError(["studentId"])), false);                 // one primary per student
        assert.equal(isGuardianEmailConflict(adapterError(["studentId", "guardianId"])), false);   // already linked
    });
});

describe("class and subject conflicts", () => {
    it("a class clash becomes CLASS_NAME_TAKEN; other errors pass through", () => {
        assert.equal((classWriteError(adapterError(["lower(btrim(name"])) as any).code, "CLASS_NAME_TAKEN");
        const boom = new Error("db down"); assert.equal(classWriteError(boom), boom);
    });
    it("a subject clash is told apart: code vs name", () => {
        assert.equal((subjectWriteError(adapterError(["code"])) as any).code, "SUBJECT_CODE_TAKEN");
        assert.equal((subjectWriteError(adapterError(["lower(btrim(name"])) as any).code, "SUBJECT_NAME_TAKEN");
    });
    it("CreateClass reports the clash a race produced, with no audit entry", async () => {
        const audits: any[] = [];
        const d: any = {
            classRepository: { findAllClasses: async () => [], createClass: async () => { throw adapterError(["lower(btrim(name"]); } },
            auditService: { log: async (p: any) => audits.push(p) }, classPresenter: {},
        };
        await assert.rejects(() => new CreateClassUseCase(d).execute("sch", { name: "JSS 1", level: "JSS", capacity: 30 } as any, { userId: "u" } as any), (e: any) => e.code === "CLASS_NAME_TAKEN");
        assert.equal(audits.length, 0);
    });
});

describe("session and term conflicts", () => {
    const session = { id: "s1", name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), terms: [] };
    it("CreateSession reports the clash a race produced", async () => {
        const d: any = {
            sessionRepository: { findAllSessions: async () => [], createSession: async () => { throw adapterError(["lower(btrim(name"]); } },
            auditService: { log: async () => undefined },
        };
        await assert.rejects(() => new CreateSessionUseCase(d).execute("sch", { name: "2026/2027", startDate: "2026-09-01", endDate: "2027-07-31" } as any, { userId: "u" } as any), (e: any) => e.code === "SESSION_NAME_TAKEN");
    });
    it("a clean create still works", async () => {
        const d: any = {
            sessionRepository: { findAllSessions: async () => [], createSession: async (x: any) => ({ id: "s9", ...x, isCurrent: false, createdAt: new Date(), updatedAt: new Date() }) },
            auditService: { log: async () => undefined }, sessionMapper: { toResponse: (x: any) => x },
        };
        const r: any = await new CreateSessionUseCase(d).execute("sch", { name: "2026/2027", startDate: "2026-09-01", endDate: "2027-07-31" } as any, { userId: "u" } as any);
        assert.equal(r.id, "s9");
    });
    void session;
});

describe("unique names are also database rules", () => {
    const sql = readFileSync("prisma/tenant-migrations/20261027100000_unique_names/migration.sql", "utf8");
    it("the migration handles old duplicates first, stops on duplicate terms, then builds the four indexes", () => {
        assert.match(sql, /RAISE EXCEPTION/);
        for (const t of ["Session", "Class", "Subject"]) assert.match(sql, new RegExp(`UPDATE "${t}" x SET "name"`));
        for (const i of ['"Session_name_lower_key"', '"Term_sessionId_name_key"', '"Class_name_lower_key"', '"Subject_name_lower_key"']) assert.match(sql, new RegExp(`CREATE UNIQUE INDEX ${i}`));
        assert.ok(sql.lastIndexOf("UPDATE") < sql.indexOf("CREATE UNIQUE INDEX"), "tidy before indexing");
    });
});
