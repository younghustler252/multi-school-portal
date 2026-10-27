import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { StaffNameLookup } from "../../services/staff-names";
import { SubjectPresenter, AssignmentResponse } from "../../services/subject-presenter";
import { requireTeachingStaff } from "../../services/teacher-rule";
import { ClassSubjectAssignmentSource } from "../../domain/class.enums";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { AssignSubjectDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository; staffRepository: IStaffRepository; sessionRepository: ISessionRepository;
    staffNameLookup: StaffNameLookup; subjectPresenter: SubjectPresenter; auditService: AuditService;
}

/*
| ASSIGN A SUBJECT TEACHER in a class for a term (a manual choice, which automatic rules never overwrite).
| The class, subject and term must exist and the teacher must be an active TEACHING staff member.
| If the class already has this subject for the term, the teacher is changed.
*/
export class AssignSubjectUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classId: string, dto: AssignSubjectDtoType, actor: ClassActor): Promise<AssignmentResponse> {
        const d = this.d;
        if (!(await d.classRepository.findClassById(classId))) throw classErrors.notFound();
        if (!(await d.classRepository.findSubjectById(dto.subjectId))) throw classErrors.subjectNotFound();
        if (!(await d.sessionRepository.findTermById(dto.termId))) throw classErrors.termNotFound();
        await requireTeachingStaff(d.staffRepository, dto.staffId, classErrors.subjectTeacherInvalid);

        const existing = await d.classRepository.findClassSubject(classId, dto.subjectId, dto.termId);
        if (existing && existing.staffId === dto.staffId && existing.assignedVia === ClassSubjectAssignmentSource.manual)
            return (await d.subjectPresenter.assignments([existing]))[0];            // nothing to change

        const row = existing
            ? await d.classRepository.updateClassSubject(existing.id, { staffId: dto.staffId, assignedVia: ClassSubjectAssignmentSource.manual })
            : await d.classRepository.assignSubject({ classId, subjectId: dto.subjectId, staffId: dto.staffId, termId: dto.termId, assignedVia: ClassSubjectAssignmentSource.manual });

        const result = (await d.subjectPresenter.assignments([row]))[0];
        const old = existing ? (await d.staffNameLookup.one(existing.staffId))?.name ?? null : null;
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "class_subject.assigned", entity: "ClassSubject", entityId: row.id,
            ...(existing ? { oldValue: { class: result.class.name, subject: result.subject.name, teacher: old } } : {}),
            newValue: { class: result.class.name, subject: result.subject.name, teacher: result.teacher?.name ?? null, term: result.term ? `${result.term.session?.name ?? ""} ${result.term.name}`.trim() : null },
        });
        return result;
    }
}
