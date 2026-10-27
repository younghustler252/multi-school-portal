import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { TeachingModelReader } from "../../services/teaching-model";
import { planTermAssignments } from "../../services/class-subject-plan";
import { ClassSubjectAssignmentSource } from "../../domain/class.enums";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; teachingModelReader: TeachingModelReader; auditService: AuditService }

/*
| APPLY THE TEACHING DEFAULTS to this term: every class and subject pair still without a teacher gets one (the
| subject's default teacher, or the class teacher in a homeroom school). Set-based (one plan, one insert) and
| in one transaction; anything already assigned, by hand or automatically, is never touched.
*/
export class ApplyDefaultsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actor: ClassActor): Promise<{ applied: number; message: string }> {
        const d = this.d;
        const term = await d.sessionRepository.findCurrentTerm();
        if (!term) throw classErrors.noCurrentTerm();

        const [classes, subjects, teachingModel] = await Promise.all([d.classRepository.findAllClasses(), d.classRepository.findAllSubjects(), d.teachingModelReader.get()]);
        let applied = 0;
        await getTenantClient().$transaction(async tx => {
            const existing = await tx.classSubject.findMany({ where: { termId: term.id }, select: { classId: true, subjectId: true } });
            const { seeded } = planTermAssignments({
                classes: classes.map(c => ({ id: c.id, classTeacherId: c.classTeacherId })), subjects: subjects.map(s => ({ id: s.id, defaultTeacherId: s.defaultTeacherId })),
                previous: [], existing, teachingModel,
            });
            if (seeded.length) applied = (await tx.classSubject.createMany({ data: seeded.map(a => ({ ...a, assignedVia: a.assignedVia as ClassSubjectAssignmentSource, termId: term.id })), skipDuplicates: true })).count;
        }, { maxWait: 5000, timeout: 30000 });

        if (applied) await d.auditService.log({ userId: actor.userId, schoolId, action: "class_subject.defaults_applied", entity: "Term", entityId: term.id, newValue: { applied } });
        return { applied, message: `${applied} assignment(s) applied.` };
    }
}
