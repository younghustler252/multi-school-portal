import { AuditService } from "../../audit/services/audit.service";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";
import { DeactivateStudentDtoType } from "../dtos/student.dto";

interface Dependencies { studentRepository: IStudentRepository; studentMapper: StudentMapper; auditService: AuditService; }

/*
| DEACTIVATE. A student is never erased: enrolments, grades, attendance and invoices stay linked.
| (An inactive student does not count toward the plan's student limit.)
*/
export class DeactivateStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: DeactivateStudentDtoType, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        const student = await d.studentRepository.findById(id);
        if (!student) throw studentErrors.notFound();
        if (!student.isActive) throw studentErrors.alreadyInactive();

        const updated = await d.studentRepository.update(id, { isActive: false });
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.deactivated", entity: "Student", entityId: id,
            newValue: { name: `${student.firstName} ${student.lastName}`, reason: dto?.reason ?? null },
        });
        return d.studentMapper.toResponse(updated);
    }
}
