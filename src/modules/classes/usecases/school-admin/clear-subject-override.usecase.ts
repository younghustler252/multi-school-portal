import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { StaffNameLookup } from "../../services/staff-names";
import { SubjectPresenter, AssignmentResponse } from "../../services/subject-presenter";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { removeAssignment } from "./remove-subject.usecase";

interface Dependencies {
    classRepository: IClassRepository; classSubjectResolutionService: ClassSubjectResolutionService;
    staffNameLookup: StaffNameLookup; subjectPresenter: SubjectPresenter; auditService: AuditService;
}

/*
| CLEAR A HAND-PICKED TEACHER: the class goes back to the automatic rule (the subject's default teacher, or the
| class teacher in a homeroom school). If there is nothing to fall back to, the assignment is removed (unless grades exist).
*/
export class ClearSubjectOverrideUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classSubjectId: string, actor: ClassActor): Promise<{ removed: boolean; assignment: AssignmentResponse }> {
        const d = this.d;
        const existing = await d.classRepository.findClassSubjectById(classSubjectId);
        if (!existing) throw classErrors.assignmentNotFound();
        const resolved = await d.classSubjectResolutionService.resolve(existing.classId, existing.subjectId);
        if (!resolved) return { removed: true, assignment: await removeAssignment(d, schoolId, classSubjectId, actor, "class_subject.override_cleared") };

        const before = (await d.staffNameLookup.one(existing.staffId))?.name ?? null;
        const updated = await d.classRepository.updateClassSubject(classSubjectId, { staffId: resolved.staffId, assignedVia: resolved.assignedVia });
        const assignment = (await d.subjectPresenter.assignments([updated]))[0];
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "class_subject.override_cleared", entity: "ClassSubject", entityId: classSubjectId,
            oldValue: { class: assignment.class.name, subject: assignment.subject.name, teacher: before }, newValue: { teacher: assignment.teacher?.name ?? null, assignedVia: resolved.assignedVia },
        });
        return { removed: false, assignment };
    }
}
