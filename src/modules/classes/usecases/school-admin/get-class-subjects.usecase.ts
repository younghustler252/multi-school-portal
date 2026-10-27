import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { StaffNameLookup, StaffRef } from "../../services/staff-names";
import { SubjectRef } from "../../services/subject-presenter";
import { classErrors } from "../../domain/class.errors";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; staffNameLookup: StaffNameLookup }

/** One line of a class's subject list for a term. `id` is null for a subject with no teacher yet. */
export interface ClassSubjectLine { id: string | null; subject: SubjectRef; teacher: StaffRef | null; assignedVia: string | null }

/* SUBJECTS OF A CLASS for a term (the current term when none is given), with each teacher's name (one lookup for the whole list). */
export class GetClassSubjectsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(classId: string, termId?: string): Promise<ClassSubjectLine[]> {
        const resolved = termId ?? (await this.d.sessionRepository.findCurrentTerm())?.id;
        if (!resolved) throw classErrors.termNotFound();
        if (!(await this.d.classRepository.findClassById(classId))) throw classErrors.notFound();

        const rows = await this.d.classRepository.findClassSubjectsEnriched(classId, resolved);
        const teachers = await this.d.staffNameLookup.byIds(rows.map(r => r.staffId));
        return rows.map(r => ({
            id: r.classSubjectId, subject: { id: r.subjectId, name: r.subjectName, code: r.subjectCode },
            teacher: r.staffId ? teachers.get(r.staffId) ?? null : null, assignedVia: r.assignedVia,
        }));
    }
}
