import { AppError } from "../../../shared/errors/domain.errors";
import { IStaffRepository } from "../repositories/staff.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { assertCanActOnStaff } from "../services/staff-scope";
import { staffErrors } from "../domain/staff.errors";
import type { Access } from "../../../foundation/access.service";

interface Dependencies { staffRepository: IStaffRepository; classRepository: IClassRepository; sessionRepository: ISessionRepository }

export interface MyClassSubjectData { classSubjectId: string; subjectId: string; subjectName: string; subjectCode: string | null }
export interface MySubjectClassResponseData { classId: string; className: string; subjects: MyClassSubjectData[] }
export interface MyHomeroomClassResponseData { classId: string; className: string; studentCount: number }
export interface MyClassesResponse { classesAsClassTeacher: MyHomeroomClassResponseData[]; classesAsSubjectTeacher: MySubjectClassResponseData[] }
export interface StaffAssignmentResponseData { classSubjectId: string; classId: string; className: string; subjectId: string; subjectName: string; subjectCode: string | null }

const noTerm = () => new AppError("No current term is set.", 400, true, "NO_CURRENT_TERM");

/*
| The classes and subjects a staff member teaches this term.
| These read the classes and sessions modules, which are rebuilt later; they keep working unchanged until then.
| The staff member is identified from the SESSION (access.personaEntityId), no longer looked up through the user.
*/
export class GetMyClassesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access): Promise<MyClassesResponse> {
        const d = this.d;
        if (!access.personaEntityId) throw staffErrors.notFound();
        const term = await d.sessionRepository.findCurrentTerm();
        if (!term) throw noTerm();

        const [homerooms, assignments] = await Promise.all([
            d.classRepository.findClassesByClassTeacher(access.personaEntityId),
            d.classRepository.findStaffAssignments(access.personaEntityId, term.id),
        ]);

        const grouped = new Map<string, MySubjectClassResponseData>();
        for (const a of assignments) {
            if (!grouped.has(a.classId)) grouped.set(a.classId, { classId: a.classId, className: a.className, subjects: [] });
            grouped.get(a.classId)!.subjects.push({ classSubjectId: a.classSubjectId, subjectId: a.subjectId, subjectName: a.subjectName, subjectCode: a.subjectCode });
        }
        return { classesAsClassTeacher: homerooms, classesAsSubjectTeacher: [...grouped.values()] };
    }
}

export class GetStaffAssignmentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(staffId: string, access: Access): Promise<StaffAssignmentResponseData[]> {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(staffId);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(access, "staff.view", staff.id, (staff.branches ?? []).map(b => b.id));

        const term = await d.sessionRepository.findCurrentTerm();
        if (!term) throw noTerm();
        return d.classRepository.findStaffAssignments(staffId, term.id);
    }
}
