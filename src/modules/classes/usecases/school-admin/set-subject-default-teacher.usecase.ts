import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { StaffNameLookup } from "../../services/staff-names";
import { SubjectPresenter, SubjectResponse } from "../../services/subject-presenter";
import { requireTeachingStaff } from "../../services/teacher-rule";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";

interface Dependencies {
    classRepository: IClassRepository; staffRepository: IStaffRepository; sessionRepository: ISessionRepository;
    classSubjectResolutionService: ClassSubjectResolutionService; staffNameLookup: StaffNameLookup;
    subjectPresenter: SubjectPresenter; auditService: AuditService;
}

/*
| SET A SUBJECT'S DEFAULT TEACHER (null clears it). The teacher must be an active TEACHING staff member.
| This term's classes that were filled in from the old default follow the new one; hand-picked teachers never change.
*/
export class SetSubjectDefaultTeacherUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, subjectId: string, staffId: string | null, actor: ClassActor): Promise<SubjectResponse> {
        const d = this.d;
        const subject = await d.classRepository.findSubjectById(subjectId);
        if (!subject) throw classErrors.subjectNotFound();
        if (staffId) await requireTeachingStaff(d.staffRepository, staffId, classErrors.subjectTeacherInvalid);
        if (subject.defaultTeacherId === staffId) return (await d.subjectPresenter.subjects([subject]))[0];

        const names = await d.staffNameLookup.byIds([subject.defaultTeacherId, staffId]);
        const updated = await d.classRepository.setSubjectDefaultTeacher(subjectId, staffId);
        const term = await d.sessionRepository.findCurrentTerm();
        if (term) await d.classSubjectResolutionService.recascadeSubjectDefault(subjectId, term.id);

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "subject.default_teacher_set", entity: "Subject", entityId: subjectId,
            oldValue: { subject: subject.name, teacher: subject.defaultTeacherId ? names.get(subject.defaultTeacherId)?.name ?? null : null },
            newValue: { teacher: staffId ? names.get(staffId)?.name ?? null : null },
        });
        return (await d.subjectPresenter.subjects([updated ?? { ...subject, defaultTeacherId: staffId }]))[0];
    }
}
