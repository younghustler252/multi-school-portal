import { IStudentRepository } from "../repositories/student.repository";
import { statusWhere } from "./student-queries.usecases";
import { LookupStudentsQueryType } from "../dtos/student.dto";
import { StudentEntity } from "../domain/student.entity";

interface Dependencies { studentRepository: IStudentRepository }

/** What a lookup returns about a student. Nothing about their health, family, address or background. */
export interface StudentLookupItem {
    id: string; admissionNumber: string | null; firstName: string; lastName: string; middleName: string | null;
    branchId: string; status: "active" | "inactive" | "graduated"; currentClass: { id: string; name: string } | null;
}

const statusOf = (s: StudentEntity): StudentLookupItem["status"] => (s.graduatedAt ? "graduated" : s.isActive ? "active" : "inactive");

/*
| FIND A STUDENT (students.lookup, ALL scope, staff only): the bursar's picker. A search of at least 2 letters is required,
| at most 25 come back, and each one carries only the fields above. Graduated and inactive students can be asked for
| (status), because their accounts may still owe money.
*/
export class LookupStudentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: LookupStudentsQueryType): Promise<StudentLookupItem[]> {
        const repo = this.d.studentRepository;
        const found = await repo.searchStudents(query.search, { page: 1, limit: query.limit, where: statusWhere(query.status), orderBy: { lastName: "asc" } });
        const classes = await repo.currentClasses(found.data.map(s => s.id));
        return found.data.map(s => ({
            id: s.id, admissionNumber: s.admissionNumber, firstName: s.firstName, lastName: s.lastName, middleName: s.middleName,
            branchId: s.branchId, status: statusOf(s), currentClass: classes.get(s.id) ?? null,
        }));
    }
}
