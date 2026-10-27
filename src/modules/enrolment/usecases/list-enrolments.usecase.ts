import type { Access } from "../../../foundation/access.service";
import { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { EnrolmentPresenter, EnrolmentResponse } from "../services/enrolment-presenter";
import { enrolmentScopeWhere } from "../services/enrolment-scope";
import { ListEnrolmentsQueryType } from "../dtos/enrolment.dto";

interface Dependencies { enrolmentRepository: IEnrolmentRepository; sessionRepository: ISessionRepository; enrolmentPresenter: EnrolmentPresenter }

/*
| LIST ENROLMENTS (a class list). Limited to what the viewer may see (enrolment-scope.ts). The current term is
| used when no term is given. `search` matches the student's name or admission number; every word typed must match.
*/
export class ListEnrolmentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListEnrolmentsQueryType, access: Access): Promise<PaginatedResult<EnrolmentResponse>> {
        const termId = q.termId ?? (await this.d.sessionRepository.findCurrentTerm())?.id;
        const words = (q.search ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
        const where = { AND: [
            enrolmentScopeWhere(access),
            termId ? { termId } : {},
            q.classId ? { classId: q.classId } : {},
            q.studentId ? { studentId: q.studentId } : {},
            q.status ? { status: q.status } : {},
            ...words.map(w => ({ student: { OR: [
                { firstName: { contains: w, mode: "insensitive" } }, { lastName: { contains: w, mode: "insensitive" } },
                { middleName: { contains: w, mode: "insensitive" } }, { admissionNumber: { contains: w, mode: "insensitive" } },
            ] } })),
        ] };
        const result = await this.d.enrolmentRepository.paginate({ page: q.page, limit: q.limit, where, orderBy: { student: { lastName: "asc" } } });
        return { data: await this.d.enrolmentPresenter.many(result.data), meta: result.meta };
    }
}
