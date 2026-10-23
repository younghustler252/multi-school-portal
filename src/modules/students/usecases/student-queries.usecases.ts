import type { Access } from "../../../foundation/access.service";
import { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { StudentPhotoService } from "../services/student-photo.service";
import { studentErrors } from "../domain/student.errors";
import { studentScopeWhere } from "../services/student-scope";
import { ListStudentsQueryType } from "../dtos/student.dto";

interface Dependencies { studentRepository: IStudentRepository; studentMapper: StudentMapper; studentPhotoService: StudentPhotoService; }

/*
| READS. Every read is limited to what the viewer may see (student-scope.ts). A student outside the viewer's
| scope is reported as "not found", so nobody can learn that an id exists by guessing.
*/
export class ListStudentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListStudentsQueryType, access: Access): Promise<PaginatedResult<StudentResponseData>> {
        const { studentRepository: repo, studentPhotoService: photos } = this.d;
        const where = {
            AND: [
                studentScopeWhere(access),
                query.status === "all" ? {} : { isActive: query.status === "active" },
                query.gender ? { gender: query.gender } : {},
            ],
        };
        const params = { page: query.page, limit: query.limit, where, orderBy: { createdAt: "desc" } };
        const result = query.search ? await repo.searchStudents(query.search, params) : await repo.paginate(params);
        return { data: await photos.toResponses(result.data), meta: result.meta };
    }
}

export class GetStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, access: Access): Promise<StudentResponseData> {
        const student = await this.d.studentRepository.findOne({ AND: [{ id }, studentScopeWhere(access)] });
        if (!student) throw studentErrors.notFound();
        return this.d.studentPhotoService.toResponse(student);
    }
}

/** A student looking at their own record (GET /students/me). */
export class GetMyStudentProfileUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access): Promise<StudentResponseData> {
        if (access.persona !== "STUDENT" || !access.personaEntityId) throw studentErrors.notFound();
        const student = await this.d.studentRepository.findById(access.personaEntityId);
        if (!student) throw studentErrors.notFound();
        return this.d.studentPhotoService.toResponse(student);
    }
}
