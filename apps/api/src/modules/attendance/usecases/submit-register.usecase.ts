import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { lockClass } from "../../enrolment/services/class-seats";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { NameRef, StudentRef, TermRef, studentRef, termRef } from "../services/attendance-presenter";
import { classInScope } from "../services/attendance-scope";
import { resolveSchoolDay } from "../services/attendance-day";
import { attendanceErrors } from "../domain/attendance.errors";
import { addDays, withinEditWindow } from "../domain/attendance.policy";
import { AttendanceActor } from "../domain/attendance.types";
import { SubmitRegisterDtoType } from "../dtos/attendance.dto";

export type SkipReason = "not_on_class_list" | "duplicate_entry" | "edit_window_closed";
export interface SubmitRegisterResult {
    class: NameRef; date: string; term: TermRef;
    created: number; updated: number; unchanged: number;
    skipped: Array<{ student: StudentRef | null; studentId: string; reason: SkipReason }>;
    unmarked: StudentRef[];     // on the class list, still without a mark for this day
}

interface Dependencies { attendanceRepository: AttendanceRepository; auditService: AuditService }

/*
| TAKE THE REGISTER for one class and one day. One request, one transaction.
|  - The day must be a real date, not in the future, inside a term (the term is found from the date) and not a calendar holiday.
|  - A teacher may take it only for a class they lead or teach in that term (attendance.mark scope).
|  - Every student must be on the class list for that term. Students who are not, repeated students, and marks that can
|    no longer be changed are SKIPPED WITH A REASON; everyone else is saved. The result says what happened to each.
|  - Sending the same register again is safe: marks that are the same are left alone ("unchanged"), others are updated.
|  - A mark already made can be changed within 48 hours of when it was first made; after that only attendance.override can.
|  - The class row is locked while saving, so two people submitting the same register are handled one after the other.
|  - The mark records who saved it last (their login). Old to new values are audited.
*/
export class SubmitRegisterUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classId: string, dto: SubmitRegisterDtoType, access: Access, actor: AttendanceActor): Promise<SubmitRegisterResult> {
        const repo = this.d.attendanceRepository;
        const sd = await resolveSchoolDay(repo, dto.date, true);
        const cls = await repo.findClass(classId);
        if (!cls) throw attendanceErrors.classNotFound();
        if (!(await classInScope(access, "attendance.mark", classId, sd.term.id))) throw attendanceErrors.notYourClass();

        const enrolled = await repo.studentsOnRegister(classId, sd.term.id);
        const onList = new Map(enrolled.map(e => [e.studentId, studentRef(e.student)]));

        // Sort the entries into "save these" and "skip these, and why"
        const skipped: SubmitRegisterResult["skipped"] = [];
        const seen = new Set<string>();
        const valid: SubmitRegisterDtoType["entries"] = [];
        const strangers: string[] = [];
        for (const e of dto.entries) {
            if (seen.has(e.studentId)) { skipped.push({ student: onList.get(e.studentId) ?? null, studentId: e.studentId, reason: "duplicate_entry" }); continue; }
            seen.add(e.studentId);
            if (!onList.has(e.studentId)) { strangers.push(e.studentId); continue; }
            valid.push(e);
        }
        if (strangers.length) {
            const found = await getTenantClient().student.findMany({ where: { id: { in: strangers } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
            const byId = new Map(found.map(s => [s.id, studentRef(s)]));
            for (const id of strangers) skipped.push({ student: byId.get(id) ?? null, studentId: id, reason: "not_on_class_list" });
        }

        const canOverride = access.can("attendance.override");
        const now = new Date();
        let created = 0, updated = 0, unchanged = 0;
        const changes: Array<{ student: string; from: string | null; to: string }> = [];
        const markedIds = new Set<string>();

        if (valid.length) {
            await getTenantClient().$transaction(async tx => {
                await lockClass(tx as any, classId);
                const existing = await tx.attendance.findMany({ where: { studentId: { in: valid.map(v => v.studentId) }, date: { gte: sd.date, lt: addDays(sd.date, 1) } }, orderBy: { createdAt: "asc" } });
                const rowsOf = new Map<string, typeof existing>();
                for (const r of existing) rowsOf.set(r.studentId, [...(rowsOf.get(r.studentId) ?? []), r]);

                const toCreate: Array<{ studentId: string; termId: string; classId: string; date: Date; status: any; note: string | null; markedById: string }> = [];
                for (const e of valid) {
                    const mine = rowsOf.get(e.studentId) ?? [];
                    const row = mine.find(r => r.date.getTime() === sd.date.getTime()) ?? mine[0];   // normally one; old data could hold two
                    const note = e.note ?? null;
                    if (!row) {
                        toCreate.push({ studentId: e.studentId, termId: sd.term.id, classId, date: sd.date, status: e.status, note, markedById: actor.userId });
                        markedIds.add(e.studentId); changes.push({ student: onList.get(e.studentId)!.name, from: null, to: e.status });
                        continue;
                    }
                    markedIds.add(e.studentId);
                    if (row.status === e.status && (row.note ?? null) === note) { unchanged++; continue; }
                    if (!withinEditWindow(row.createdAt, now) && !canOverride) { skipped.push({ student: onList.get(e.studentId)!, studentId: e.studentId, reason: "edit_window_closed" }); continue; }
                    await tx.attendance.update({
                        where: { id: row.id },
                        data: { status: e.status, note, classId, termId: sd.term.id, markedById: actor.userId, ...(mine.length === 1 ? { date: sd.date } : {}) },
                    });
                    updated++; changes.push({ student: onList.get(e.studentId)!.name, from: row.status, to: e.status });
                }
                if (toCreate.length) { await tx.attendance.createMany({ data: toCreate }); created = toCreate.length; }
            }, { maxWait: 5000, timeout: 30000 });
        }

        // who on the class list still has no mark for the day
        const all = enrolled.length ? await repo.rowsForDay(enrolled.map(e => e.studentId), sd.date) : [];
        const marked = new Set(all.map(r => r.studentId));
        const unmarked = enrolled.filter(e => !marked.has(e.studentId)).map(e => studentRef(e.student));

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "attendance.register_submitted", entity: "Class", entityId: classId,
            newValue: {
                class: cls.name, date: dto.date, term: `${sd.term.session?.name ?? ""} ${sd.term.name}`.trim(),
                created, updated, unchanged, skipped: skipped.length, unmarked: unmarked.length,
                changes: changes.slice(0, 100),
            },
        });
        return { class: { id: cls.id, name: cls.name }, date: dto.date, term: termRef(sd.term), created, updated, unchanged, skipped, unmarked };
    }
}
