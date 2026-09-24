import { IStaffRepository } from "../repositories/staff.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors/domain.errors";
import { StaffErrorMessage } from "../domain/staff.enums";

interface Dependencies {
    staffRepository: IStaffRepository;
    classRepository: IClassRepository;
    sessionRepository: ISessionRepository;
}

export interface MyClassSubjectData {
    classSubjectId: string;
    subjectId:      string;
    subjectName:    string;
    subjectCode:    string | null;
}

export interface MySubjectClassResponseData {
    classId:   string;
    className: string;
    subjects:  MyClassSubjectData[];
}

export interface MyHomeroomClassResponseData {
    classId:      string;
    className:    string;
    studentCount: number;
}

export interface MyClassesResponse {
    classesAsClassTeacher:   MyHomeroomClassResponseData[];
    classesAsSubjectTeacher: MySubjectClassResponseData[];
}

export class GetMyClassesUseCase {
    private readonly staffRepository: IStaffRepository;
    private readonly classRepository: IClassRepository;
    private readonly sessionRepository: ISessionRepository;

    constructor({
        staffRepository,
        classRepository,
        sessionRepository,
    }: Dependencies) {
        this.staffRepository = staffRepository;
        this.classRepository = classRepository;
        this.sessionRepository = sessionRepository;
    }

    async execute(userId: string): Promise<MyClassesResponse> {
        const staff = await this.staffRepository.findByUserId(userId);

        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        const currentTerm = await this.sessionRepository.findCurrentTerm();

        if (!currentTerm) {
            throw new BadRequestError("No current term set.");
        }

        const [homerooms, assignments] = await Promise.all([
            this.classRepository.findClassesByClassTeacher(staff.id),
            this.classRepository.findStaffAssignments(
                staff.id,
                currentTerm.id,
            ),
        ]);

        const grouped = new Map<string, MySubjectClassResponseData>();

        for (const a of assignments) {
            if (!grouped.has(a.classId)) {
                grouped.set(a.classId, {
                    classId:   a.classId,
                    className: a.className,
                    subjects:  [],
                });
            }

            grouped.get(a.classId)!.subjects.push({
                classSubjectId: a.classSubjectId,
                subjectId:      a.subjectId,
                subjectName:    a.subjectName,
                subjectCode:    a.subjectCode,
            });
        }

        return {
            classesAsClassTeacher:   homerooms,
            classesAsSubjectTeacher: Array.from(grouped.values()),
        };
    }
}
