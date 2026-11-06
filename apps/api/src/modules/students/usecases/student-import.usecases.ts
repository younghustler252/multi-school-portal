import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { PlanLimitError } from "../../../shared/errors/domain.errors";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { AuditService } from "../../audit/services/audit.service";
import { wouldOverflow } from "../../enrolment/services/class-seats";
import type { IStudentRepository } from "../repositories/student.repository";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";
import { ImportContext, PlannedRow, isFileProblem, parseBirthDate, parseImportCsv, personKey, planImportRows } from "../domain/student-import.policy";
import { nextAdmissionNumber, Tx } from "./create-student.usecase";

interface Dependencies { numberSequenceService: NumberSequenceService; auditService: AuditService; studentRepository: IStudentRepository }

/* Reads the file, looks up what already exists in the school, and decides every row (the SAME for preview and import). */
async function analyse(repo: IStudentRepository, buffer: Buffer, now: Date) {
    const parsed = parseImportCsv(buffer);
    if (isFileProblem(parsed)) throw studentErrors.importFile(parsed.message, parsed.code, parsed.missing);

    const term = await repo.findCurrentTermRef();
    const classRows = await repo.classesWithPlaces(term?.id ?? null);

    const typed = [...new Set(parsed.rows.map(r => (r.admissionNumber ?? "").trim()).filter(Boolean))];
    const known = await repo.takenAdmissionNumbers(typed);

    const dobs = parsed.rows.map(r => (r.dateOfBirth ? parseBirthDate(r.dateOfBirth.trim(), now) : null)).filter((p): p is { date: Date } => !!p && "date" in p).map(p => p.date.getTime());
    const people = new Set<string>();
    if (dobs.length) {
        const from = new Date(Math.min(...dobs)), to = new Date(Math.max(...dobs) + 86_400_000);
        for (const s of await repo.peopleBornBetween(from, to)) if (s.dateOfBirth) people.add(personKey(s.firstName, s.lastName, s.dateOfBirth));
    }
    const ctx: ImportContext = {
        now, hasCurrentTerm: !!term, existingAdmissionNumbers: new Set(known), existingPeople: people,
        classes: new Map(classRows.map(c => [c.name.trim().toLowerCase(), { id: c.id, name: c.name, capacity: c.capacity, enrolled: c.enrolled }])),
    };
    return { ...planImportRows(parsed.rows, ctx), term, ignoredColumns: parsed.ignoredColumns, classes: ctx.classes };
}

const rowView = (r: PlannedRow, created?: { id: string; name: string; admissionNumber: string | null }) => ({
    row: r.row, status: created ? "created" as const : r.status, name: r.name, class: r.className ?? null, messages: r.messages, student: created ?? null,
});

/*
| PREVIEW A STUDENT IMPORT: checks every row and saves NOTHING. Shows what the import would do, every problem in plain words,
| and whether the plan has room for the new students.
*/
export class PreviewStudentImportUseCase {
    constructor(private readonly d: { studentRepository: IStudentRepository }) {}

    async execute(schoolId: string, file: { buffer: Buffer; name: string }) {
        const a = await analyse(this.d.studentRepository, file.buffer, new Date());
        let planLimit: { allowed: boolean; adding: number; limit?: number; current?: number } = { allowed: true, adding: a.summary.ok };
        if (a.summary.ok > 0) {
            try { await assertWithinPlanLimit(schoolId, "student", a.summary.ok); }
            catch (e) { if (!(e instanceof PlanLimitError)) throw e; const d = (e as any).details ?? {}; planLimit = { allowed: false, adding: a.summary.ok, limit: d.limit, current: d.current }; }
        }
        return { file: { name: file.name, rows: a.summary.total }, summary: { ...a.summary, willCreate: planLimit.allowed ? a.summary.ok : 0 }, planLimit, ignoredColumns: a.ignoredColumns, rows: a.rows.map(r => rowView(r)) };
    }
}

/*
| IMPORT STUDENTS from a CSV file. The same checks as the preview, then:
|  - the plan must have room for every new student, otherwise nothing is imported;
|  - all the valid rows are saved in ONE transaction (student, class place, guardian and link together), so a row is never half
|    saved, and if something unexpected fails nothing is saved at all;
|  - rows that are not valid (or are duplicates) are returned with their reasons and are not saved;
|  - blank admission numbers are generated (the next free one); a guardian with the same email is reused, so brothers and
|    sisters share one parent; the first guardian of a student is their primary guardian.
*/
export class ImportStudentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, file: { buffer: Buffer; name: string }, actor: StudentActor) {
        const now = new Date();
        const a = await analyse(this.d.studentRepository, file.buffer, now);
        const ok = a.rows.filter(r => r.status === "ok");
        const created = new Map<number, { id: string; name: string; admissionNumber: string | null }>();
        let guardiansCreated = 0, guardiansLinked = 0;

        if (ok.length > 0) {
            await assertWithinPlanLimit(schoolId, "student", ok.length);
            const termId = a.term?.id;
            try {
                await this.d.studentRepository.transaction(async tx => {
                    // the class seats are checked again under a lock: another person may have filled a class since the preview
                    const perClass = new Map<string, number>();
                    for (const r of ok) if (r.classId) perClass.set(r.classId, (perClass.get(r.classId) ?? 0) + 1);
                    for (const classId of [...perClass.keys()].sort()) {
                        const info = [...a.classes.values()].find(c => c.id === classId)!;
                        if (wouldOverflow(info.capacity, await tx.lockAndCount(classId, termId!), perClass.get(classId)!)) throw studentErrors.importClassFilled(info.name);
                    }
                    for (const r of ok) {
                        const s = r.student!;
                        const row = await tx.createStudent(
                            { admissionNumber: s.admissionNumber ?? undefined, firstName: s.firstName, lastName: s.lastName, middleName: s.middleName, dateOfBirth: s.dateOfBirth, gender: s.gender, admittedAt: now, isActive: true },
                            raw => nextAdmissionNumber(this.d.numberSequenceService, raw as Tx, now));
                        if (r.classId) await tx.enrol(row.id, r.classId, termId!);
                        if (r.guardian) {
                            const g = r.guardian;
                            const res = await tx.linkGuardian({ firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone }, { studentId: row.id, relation: g.relation, isPrimary: true });
                            if (res.outcome === "created") guardiansCreated++; else guardiansLinked++;
                        }
                        created.set(r.row, { id: row.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNumber: row.admissionNumber });
                    }
                }, { maxWait: 10_000, timeout: 120_000 });
            } catch (err: any) {
                if (err?.code === "P2002") throw studentErrors.importConflict();
                throw err;
            }
            await this.d.auditService.log({
                userId: actor.userId, schoolId, action: "student.bulk_imported", entity: "Student", entityId: null,
                newValue: { file: file.name, total: a.summary.total, created: created.size, skipped: a.summary.skipped, errors: a.summary.errors, guardiansCreated, guardiansLinked,
                    students: [...created.values()].slice(0, 100).map(c => `${c.name} (${c.admissionNumber})`) },
            });
        }
        return {
            summary: { total: a.summary.total, created: created.size, skipped: a.summary.skipped, errors: a.summary.errors, guardiansCreated, guardiansLinked },
            rows: a.rows.map(r => rowView(r, created.get(r.row))),
        };
    }
}
