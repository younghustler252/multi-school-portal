import { IClassRepository } from "../repositories/class.repository";

/*
| WHAT A STAFF MEMBER LEADS OR TEACHES (read-only), answered by Classes.
| Classes owns the assignments (Class.classTeacherId, ClassSubject.staffId). Staff, and anything else that needs to know
| what someone teaches, asks here instead of reading Classes' tables itself. This reads; it never changes an assignment.
*/
export interface ITeachingAssignmentsReader {
    /** Classes they lead plus subjects they teach this term: what must be handed over when they stop being a teacher. */
    countActiveFor(staffId: string): Promise<number>;
    /** The classes they lead (as class teacher), with how many students are on each. */
    homeroomsOf(staffId: string): ReturnType<IClassRepository["findClassesByClassTeacher"]>;
    /** The subjects they teach in a term, class by class. */
    assignmentsOf(staffId: string, termId: string): ReturnType<IClassRepository["findStaffAssignments"]>;
}

interface Dependencies { classRepository: IClassRepository }

export class TeachingAssignmentsReader implements ITeachingAssignmentsReader {
    constructor(private readonly d: Dependencies) {}

    countActiveFor(staffId: string): Promise<number> { return this.d.classRepository.countActiveAssignmentsOf(staffId); }
    homeroomsOf(staffId: string)                     { return this.d.classRepository.findClassesByClassTeacher(staffId); }
    assignmentsOf(staffId: string, termId: string)   { return this.d.classRepository.findStaffAssignments(staffId, termId); }
}
