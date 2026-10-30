import type { Access } from "../../../foundation/access.service";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { AttendancePresenter, NameRef, StudentRef, TermRef, studentRef, termRef } from "../services/attendance-presenter";
import { classInScope } from "../services/attendance-scope";
import { resolveSchoolDay } from "../services/attendance-day";
import { attendanceErrors } from "../domain/attendance.errors";
import { isFutureDay, withinEditWindow } from "../domain/attendance.policy";

export interface RegisterRow {
    student: StudentRef; id: string | null; status: string | null; note: string | null;
    markedBy: NameRef | null; markedAt: Date | null;
    editable: boolean;     // the person looking can change this line now (window open, or they may override)
}
export interface RegisterResponse {
    class: NameRef; date: string; term: TermRef; holiday: string | null; canMark: boolean;
    students: RegisterRow[];
    summary: { present: number; absent: number; late: number; excused: number; unmarked: number };
}

interface Dependencies { attendanceRepository: AttendanceRepository; attendancePresenter: AttendancePresenter }

/*
| OPEN A CLASS REGISTER for one day: everyone on the class list that term with their mark (or none) and who marked.
| The term is found from the date. Who may open it: attendance.view for ALL classes, or ASSIGNED (a class you lead, or
| teach in the term of the date). A student or a guardian (OWN) uses the list instead. Holidays and future days can be
| looked at (nothing is marked on them); `canMark` tells the screen whether the register can be taken.
*/
export class GetRegisterUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(classId: string, dateText: string, access: Access): Promise<RegisterResponse> {
        const repo = this.d.attendanceRepository;
        const sd = await resolveSchoolDay(repo, dateText, false);
        const cls = await repo.findClass(classId);
        if (!cls) throw attendanceErrors.classNotFound();
        if (!(await classInScope(access, "attendance.view", classId, sd.term.id))) throw attendanceErrors.classNotVisible();

        const enrolled = await repo.studentsOnRegister(classId, sd.term.id);
        const rows = enrolled.length ? await repo.rowsForDay(enrolled.map(e => e.studentId), sd.date) : [];
        const rowBy = new Map(rows.map(r => [r.studentId, r]));
        const markers = await this.d.attendancePresenter.markers(rows.map(r => r.markedById));

        const canMark = access.can("attendance.mark") && !sd.holiday && !isFutureDay(dateText) && await classInScope(access, "attendance.mark", classId, sd.term.id);
        const canOverride = access.can("attendance.override");
        const summary = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
        const students: RegisterRow[] = enrolled.map(e => {
            const r = rowBy.get(e.studentId);
            if (r) summary[r.status as "present" | "absent" | "late" | "excused"]++; else summary.unmarked++;
            return {
                student: studentRef(e.student), id: r?.id ?? null, status: r?.status ?? null, note: r?.note ?? null,
                markedBy: r?.markedById ? markers.get(r.markedById) ?? null : null, markedAt: r?.createdAt ?? null,
                editable: canMark && (!r || withinEditWindow(r.createdAt) || canOverride),
            };
        });
        return { class: { id: cls.id, name: cls.name }, date: dateText, term: termRef(sd.term), holiday: sd.holiday, canMark, students, summary };
    }
}
