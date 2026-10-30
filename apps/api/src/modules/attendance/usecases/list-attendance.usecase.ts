import type { Access } from "../../../foundation/access.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { buildPaginationMeta } from "../../../shared/utils/pagination";
import { AttendancePresenter, AttendanceResponse } from "../services/attendance-presenter";
import { attendanceViewWhere } from "../services/attendance-scope";
import { attendanceErrors } from "../domain/attendance.errors";
import { addDays, parseSchoolDay } from "../domain/attendance.policy";
import { ListAttendanceQueryType } from "../dtos/attendance.dto";

interface Dependencies { attendancePresenter: AttendancePresenter }

/*
| SCOPED LIST of attendance marks (page size at most 100). What you see depends on attendance.view: everything (ALL), the
| classes you lead or teach (ASSIGNED), or only your own / your children's (OWN). Filters narrow it further and can never
| widen it. This replaces the old "my children" route: a guardian or student simply calls this list.
*/
export class ListAttendanceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListAttendanceQueryType, access: Access) {
        const filters: Record<string, unknown>[] = [attendanceViewWhere(access)];
        if (query.studentId) filters.push({ studentId: query.studentId });
        if (query.classId)   filters.push({ classId: query.classId });
        if (query.termId)    filters.push({ termId: query.termId });
        if (query.status)    filters.push({ status: query.status });
        if (query.from || query.to) {
            const from = query.from ? parseSchoolDay(query.from) : null;
            const to = query.to ? parseSchoolDay(query.to) : null;
            if ((query.from && !from) || (query.to && !to)) throw attendanceErrors.dateInvalid();
            filters.push({ date: { ...(from ? { gte: from } : {}), ...(to ? { lt: addDays(to, 1) } : {}) } });
        }
        const where = { AND: filters };
        const db = getTenantClient();
        const [total, rows] = await Promise.all([
            db.attendance.count({ where }),
            db.attendance.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
        ]);
        return { data: await this.d.attendancePresenter.many(rows), meta: buildPaginationMeta(total, query.page, query.limit) };
    }
}
