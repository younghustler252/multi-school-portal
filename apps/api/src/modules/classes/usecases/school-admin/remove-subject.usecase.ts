import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { SubjectPresenter, AssignmentResponse } from "../../services/subject-presenter";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";

interface Dependencies { classRepository: IClassRepository; subjectPresenter: SubjectPresenter; auditService: AuditService }

/* Removes a subject from a class for a term. Refused (CLASS_SUBJECT_IN_USE) once grades were recorded against it. */
export async function removeAssignment(d: Dependencies, schoolId: string, classSubjectId: string, actor: ClassActor, action: string): Promise<AssignmentResponse> {
    const existing = await d.classRepository.findClassSubjectById(classSubjectId);
    if (!existing) throw classErrors.assignmentNotFound();
    const grades = await getTenantClient().grade.count({ where: { classSubjectId } });
    if (grades > 0) throw classErrors.assignmentInUse(grades);

    const shown = (await d.subjectPresenter.assignments([existing]))[0];
    await d.classRepository.removeSubject(classSubjectId);
    await d.auditService.log({ userId: actor.userId, schoolId, action, entity: "ClassSubject", entityId: classSubjectId, oldValue: { class: shown.class?.name ?? null, subject: shown.subject?.name ?? null, teacher: shown.teacher?.name ?? null } });
    return shown;
}

export class RemoveSubjectUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, classSubjectId: string, actor: ClassActor): Promise<{ removed: AssignmentResponse }> {
        return { removed: await removeAssignment(this.d, schoolId, classSubjectId, actor, "class_subject.removed") };
    }
}
