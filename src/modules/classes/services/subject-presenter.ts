import { IClassRepository } from "../repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { StaffNameLookup, StaffRef } from "./staff-names";
import { NameRef } from "./class-presenter";

/*
| SUBJECT AND ASSIGNMENT RESPONSES carry names, not bare ids:
|   subject:    { id, name, code, description, defaultTeacher: { id, name } | null }
|   assignment: { id, class: { id, name }, subject: { id, name, code }, teacher: { id, name }, term: { id, name, session }, assignedVia }
*/
export interface SubjectRef { id: string; name: string; code: string | null }
export interface TermRef extends NameRef { session: NameRef | null }

export interface SubjectResponse { id: string; name: string; code: string | null; description: string | null; defaultTeacher: StaffRef | null }
export interface AssignmentResponse { id: string; class: NameRef | null; subject: SubjectRef | null; teacher: StaffRef | null; term: TermRef | null; assignedVia: string }

interface Deps { classRepository: IClassRepository; sessionRepository: ISessionRepository; staffNameLookup: StaffNameLookup }

export class SubjectPresenter {
    constructor(private readonly d: Deps) {}

    async subjects(list: Array<{ id: string; name: string; code: string | null; description: string | null; defaultTeacherId: string | null }>): Promise<SubjectResponse[]> {
        const names = await this.d.staffNameLookup.byIds(list.map(s => s.defaultTeacherId));
        return list.map(s => ({ id: s.id, name: s.name, code: s.code, description: s.description, defaultTeacher: s.defaultTeacherId ? names.get(s.defaultTeacherId) ?? null : null }));
    }

    async term(termId: string): Promise<TermRef | null> {
        const term = await this.d.sessionRepository.findTermById(termId);
        if (!term) return null;
        const session = await this.d.sessionRepository.findSessionById(term.sessionId);
        return { id: term.id, name: term.name, session: session ? { id: session.id, name: session.name } : null };
    }

    /** Assignments for ONE class and ONE term (a single class, subject list and term lookup for the whole batch). */
    async assignments(rows: Array<{ id: string; classId: string; subjectId: string; staffId: string; termId: string; assignedVia: string }>): Promise<AssignmentResponse[]> {
        if (rows.length === 0) return [];
        const [teachers, subjects] = await Promise.all([
            this.d.staffNameLookup.byIds(rows.map(r => r.staffId)),
            this.d.classRepository.findAllSubjects(),
        ]);
        const subjectById = new Map(subjects.map(s => [s.id, s]));
        const classNames = new Map<string, NameRef>();
        for (const id of new Set(rows.map(r => r.classId))) { const c = await this.d.classRepository.findClassById(id); if (c) classNames.set(id, { id: c.id, name: c.name }); }
        const terms = new Map<string, TermRef | null>();
        for (const id of new Set(rows.map(r => r.termId))) terms.set(id, await this.term(id));
        return rows.map(r => {
            const s = subjectById.get(r.subjectId);
            return {
                id: r.id, class: classNames.get(r.classId) ?? null,
                subject: s ? { id: r.subjectId, name: s.name, code: s.code ?? null } : null,
                teacher: teachers.get(r.staffId) ?? null, term: terms.get(r.termId) ?? null, assignedVia: r.assignedVia,
            };
        });
    }
}
