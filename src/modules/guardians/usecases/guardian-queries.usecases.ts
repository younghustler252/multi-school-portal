import type { Access } from "../../../foundation/access.service";
import { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { IGuardianRepository } from "../repositories/guardian.repository";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { StudentPhotoService } from "../../students/services/student-photo.service";
import { studentScopeWhere } from "../../students/services/student-scope";
import { StudentResponseData } from "../../students/mappers/student.mapper";
import { GuardianMapper, GuardianResponseData, GuardianWithStudentsResponseData } from "../mappers/guardian.mapper";
import { guardianErrors } from "../domain/guardian.errors";
import { ListGuardiansQueryType } from "../dtos/guardian.dto";

interface Dependencies {
    guardianRepository: IGuardianRepository; guardianMapper: GuardianMapper;
    studentRepository: IStudentRepository; studentPhotoService: StudentPhotoService;
}

/*
| A guardian's children in ONE query, limited to the students the viewer may see (the Students scope rules),
| with photo links from StudentPhotoService (private storage, short-lived links). Never a loop of queries.
*/
async function childrenOf(d: Dependencies, guardianId: string, access: Access): Promise<Array<StudentResponseData & { relation: string; isPrimary: boolean }>> {
    const links = await d.guardianRepository.findStudentLinksByGuardianId(guardianId);
    if (links.length === 0) return [];
    const students = await d.studentRepository.findMany({ AND: [{ id: { in: links.map(l => l.studentId) } }, studentScopeWhere(access)] });
    const responses = await d.studentPhotoService.toResponses(students);
    const byId = new Map(links.map(l => [l.studentId, l]));
    return responses.map(r => ({ ...r, relation: byId.get(r.id)!.relation, isPrimary: byId.get(r.id)!.isPrimary }));
}

export class ListGuardiansUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListGuardiansQueryType): Promise<PaginatedResult<GuardianResponseData>> {
        const { guardianRepository: repo, guardianMapper: mapper } = this.d;
        const params = {
            page: query.page, limit: query.limit, orderBy: { createdAt: "desc" },
            where: query.studentId ? { studentLinks: { some: { studentId: query.studentId } } } : {},
        };
        const result = query.search ? await repo.searchGuardians(query.search, params) : await repo.paginate(params);
        return { data: result.data.map(g => mapper.toResponse(g)), meta: result.meta };
    }
}

export class GetGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, access: Access): Promise<GuardianWithStudentsResponseData> {
        const guardian = await this.d.guardianRepository.findById(id);
        if (!guardian) throw guardianErrors.notFound();
        return { ...this.d.guardianMapper.toResponse(guardian), students: await childrenOf(this.d, id, access) };
    }
}

export type MyChildResponseData = Pick<StudentResponseData, "firstName" | "lastName" | "photoUrl" | "isActive"> & { studentId: string; relation: string; isPrimary: boolean };

/*
| MY CHILDREN (GET /guardians/me/children). The guardian is the one in the signed-in session (persona GUARDIAN);
| nothing the client sends is trusted as proof of who they are. Class and attendance details come back when
| Classes and Enrolment are switched on.
*/
export class GetMyChildrenUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access): Promise<MyChildResponseData[]> {
        if (access.persona !== "GUARDIAN" || !access.personaEntityId) throw guardianErrors.notFound();
        const guardian = await this.d.guardianRepository.findById(access.personaEntityId);
        if (!guardian) throw guardianErrors.notFound();
        const children = await childrenOf(this.d, guardian.id, access);
        return children.map(c => ({ studentId: c.id, relation: c.relation, isPrimary: c.isPrimary, firstName: c.firstName, lastName: c.lastName, photoUrl: c.photoUrl, isActive: c.isActive }));
    }
}
