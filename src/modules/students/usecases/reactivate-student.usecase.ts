import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { AuditService } from "../../audit/services/audit.service";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";

interface Dependencies { studentRepository: IStudentRepository; studentMapper: StudentMapper; auditService: AuditService; }

/*
| REACTIVATE. An inactive student does not count toward the plan's student limit, so the limit is checked again here.
*/
export class ReactivateStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        const student = await d.studentRepository.findById(id);
        if (!student) throw studentErrors.notFound();
        if (student.isActive) throw studentErrors.alreadyActive();
        await assertWithinPlanLimit(schoolId, "student", 1);

        const updated = await d.studentRepository.update(id, { isActive: true });
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.reactivated", entity: "Student", entityId: id,
            newValue: { name: `${student.firstName} ${student.lastName}` },
        });
        return d.studentMapper.toResponse(updated);
    }
}
