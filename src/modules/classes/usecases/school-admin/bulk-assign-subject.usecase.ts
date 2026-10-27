import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { StaffNameLookup, StaffRef } from "../../services/staff-names";
import { SubjectPresenter, SubjectRef, TermRef } from "../../services/subject-presenter";
import { NameRef } from "../../services/class-presenter";
import { requireTeachingStaff } from "../../services/teacher-rule";
import { ClassSubjectAssignmentSource } from "../../domain/class.enums";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { BulkAssignSubjectsDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository; staffRepository: IStaffRepository; sessionRepository: ISessionRepository;
    staffNameLookup: StaffNameLookup; subjectPresenter: SubjectPresenter; auditService: AuditService;
}
export interface BulkAssignResult { class: NameRef; term: TermRef | null; teacher: StaffRef | null; assigned: SubjectRef[]; skipped: SubjectRef[] }

/*
| ASSIGN ONE TEACHER to several subjects of a class for a term, in ONE transaction (all or nothing).
| Everything is checked first: class, term, teacher (active teaching staff) and every subject. A subject that
| already has a teacher for the term is skipped, never overwritten. Names come back, not just ids.
*/
export class BulkAssignSubjectsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classId: string, dto: BulkAssignSubjectsDtoType, actor: ClassActor): Promise<BulkAssignResult> {
        const d = this.d;
        const cls = await d.classRepository.findClassById(classId);
        if (!cls) throw classErrors.notFound();
        const term = await d.subjectPresenter.term(dto.termId);
        if (!term) throw classErrors.termNotFound();
        await requireTeachingStaff(d.staffRepository, dto.staffId, classErrors.subjectTeacherInvalid);

        const subjects = new Map((await d.classRepository.findAllSubjects()).map(s => [s.id, s]));
        const ids = [...new Set(dto.subjectIds)];
        if (ids.some(id => !subjects.has(id))) throw classErrors.subjectNotFound();

        const taken = new Set((await d.classRepository.findClassSubjects(classId, dto.termId)).map(r => r.subjectId));
        const toCreate = ids.filter(id => !taken.has(id));
        if (toCreate.length) await getTenantClient().$transaction(tx => tx.classSubject.createMany({
            data: toCreate.map(subjectId => ({ classId, subjectId, staffId: dto.staffId, termId: dto.termId, assignedVia: ClassSubjectAssignmentSource.manual })), skipDuplicates: true,
        }));

        const ref = (id: string): SubjectRef => ({ id, name: subjects.get(id)!.name, code: subjects.get(id)!.code });
        const result: BulkAssignResult = {
            class: { id: cls.id, name: cls.name }, term, teacher: await d.staffNameLookup.one(dto.staffId),
            assigned: toCreate.map(ref), skipped: ids.filter(id => taken.has(id)).map(ref),
        };
        if (toCreate.length) await d.auditService.log({
            userId: actor.userId, schoolId, action: "class_subject.bulk_assigned", entity: "Class", entityId: classId,
            newValue: { class: cls.name, teacher: result.teacher?.name ?? null, subjects: result.assigned.map(s => s.name), skipped: result.skipped.map(s => s.name) },
        });
        return result;
    }
}
