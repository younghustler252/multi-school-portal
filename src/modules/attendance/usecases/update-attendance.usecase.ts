import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { AttendancePresenter, AttendanceResponse } from "../services/attendance-presenter";
import { classInScope } from "../services/attendance-scope";
import { attendanceErrors } from "../domain/attendance.errors";
import { dayKey, withinEditWindow } from "../domain/attendance.policy";
import { AttendanceActor } from "../domain/attendance.types";
import { UpdateAttendanceDtoType } from "../dtos/attendance.dto";

interface Dependencies { attendanceRepository: AttendanceRepository; attendancePresenter: AttendancePresenter; auditService: AuditService }

/*
| CORRECT ONE MARK. Allowed for someone who may mark that class (attendance.mark: ALL, or ASSIGNED to its class), within 48
| hours of when the mark was first made. After that only someone with attendance.override can. Old marks that have no class
| (taken before registers existed) can only be corrected by someone with the ALL scope. Audited old to new, with names.
| The mark then shows the person who saved it last; the audit trail keeps who made it first.
*/
export class UpdateAttendanceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateAttendanceDtoType, access: Access, actor: AttendanceActor): Promise<AttendanceResponse> {
        const repo = this.d.attendanceRepository;
        const row = await repo.findById(id);
        if (!row) throw attendanceErrors.recordNotFound();

        const markScope = access.scopeOf("attendance.mark");
        const allowed = markScope === "ALL" || (!!row.classId && await classInScope(access, "attendance.mark", row.classId, row.termId));
        if (!allowed) throw attendanceErrors.notYourClass();
        if (!withinEditWindow(row.createdAt) && !access.can("attendance.override")) throw attendanceErrors.editWindowClosed();

        const data: Record<string, unknown> = {};
        if (dto.status !== undefined && dto.status !== row.status) data.status = dto.status;
        if (dto.note !== undefined && (dto.note ?? null) !== (row.note ?? null)) data.note = dto.note ?? null;
        if (Object.keys(data).length === 0) return (await this.d.attendancePresenter.many([row]))[0];

        const updated = await getTenantClient().attendance.update({ where: { id }, data: { ...data, markedById: actor.userId } });
        const db = getTenantClient();
        const [student, cls] = await Promise.all([
            db.student.findUnique({ where: { id: row.studentId }, select: { firstName: true, lastName: true } }),
            row.classId ? db.class.findUnique({ where: { id: row.classId }, select: { name: true } }) : Promise.resolve(null),
        ]);
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "attendance.updated", entity: "Attendance", entityId: id,
            oldValue: { student: student ? `${student.firstName} ${student.lastName}`.trim() : null, class: cls?.name ?? null, date: dayKey(row.date), status: row.status, note: row.note },
            newValue: { status: updated.status, note: updated.note, afterEditWindow: !withinEditWindow(row.createdAt) },
        });
        return (await this.d.attendancePresenter.many([updated]))[0];
    }
}
