import { IStudentRepository } from "../../students/repositories/student.repository";
import { StudentPhotoService } from "../../students/services/student-photo.service";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";

/*
| ENROLMENT RESPONSES carry names, not bare ids:
|   { id, student: { id, name, admissionNumber, photoUrl }, class: { id, name }, term: { id, name, session: { id, name } }, status, createdAt }
| One page = a handful of lookups (students, classes, sessions), never one per row. Student photos are short-lived
| private links from StudentPhotoService.
*/
export interface NameRef { id: string; name: string }
export interface StudentRef { id: string; name: string; admissionNumber: string | null; photoUrl: string | null }
export interface StudentLite { id: string; name: string; admissionNumber: string | null }
export interface TermRef extends NameRef { session: NameRef | null }
export interface EnrolmentResponse { id: string; student: StudentRef | null; class: NameRef | null; term: TermRef | null; status: string; createdAt: Date }

export interface EnrolmentRow { id: string; studentId: string; classId: string; termId: string; status: string; createdAt: Date }
interface Deps { studentRepository: IStudentRepository; studentPhotoService: StudentPhotoService; classRepository: IClassRepository; sessionRepository: ISessionRepository }

export class EnrolmentPresenter {
    constructor(private readonly d: Deps) {}

    async classMap(): Promise<Map<string, NameRef>> {
        return new Map((await this.d.classRepository.findAllClasses()).map(c => [c.id, { id: c.id, name: c.name }]));
    }

    async termMap(): Promise<Map<string, TermRef>> {
        const out = new Map<string, TermRef>();
        for (const s of await this.d.sessionRepository.findAllSessions())
            for (const t of s.terms ?? []) out.set(t.id, { id: t.id, name: t.name, session: { id: s.id, name: s.name } });
        return out;
    }

    /** Student names (no photos) for any list of ids. */
    async studentLites(ids: string[]): Promise<Map<string, StudentLite>> {
        const unique = [...new Set(ids)];
        const students = unique.length ? await this.d.studentRepository.findMany({ id: { in: unique } }) : [];
        return new Map(students.map(s => [s.id, { id: s.id, name: [s.firstName, s.lastName].filter(Boolean).join(" "), admissionNumber: s.admissionNumber }]));
    }

    async many(rows: EnrolmentRow[]): Promise<EnrolmentResponse[]> {
        if (rows.length === 0) return [];
        const ids = [...new Set(rows.map(r => r.studentId))];
        const students = await this.d.studentRepository.findMany({ id: { in: ids } });
        const withPhotos = await this.d.studentPhotoService.toResponses(students);
        const byId = new Map(withPhotos.map(s => [s.id, s]));
        const [classes, terms] = await Promise.all([this.classMap(), this.termMap()]);
        return rows.map(r => {
            const s = byId.get(r.studentId);
            return {
                id: r.id,
                student: s ? { id: r.studentId, name: [s.firstName, s.lastName].filter(Boolean).join(" "), admissionNumber: s.admissionNumber ?? null, photoUrl: s.photoUrl ?? null } : null,
                class: classes.get(r.classId) ?? null,
                term: terms.get(r.termId) ?? null, status: r.status, createdAt: r.createdAt,
            };
        });
    }

    async one(row: EnrolmentRow): Promise<EnrolmentResponse> { return (await this.many([row]))[0]; }
}
