import { IStaffRepository } from "../repositories/staff.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { NotFoundError }    from "../../../shared/errors/domain.errors";
import { StaffErrorMessage } from "../domain/staff.enums";

interface Dependencies {
    staffRepository: IStaffRepository;
    classRepository: IClassRepository;
}

export interface MyClassSubjectData {
    classSubjectId: string;
    subjectId:      string;
    subjectName:    string;
    subjectCode:    string | null;
}

export interface MyClassResponseData {
    classId:   string;
    className: string;
    subjects:  MyClassSubjectData[];
}

export class GetMyClassesUseCase {
    private readonly staffRepository: IStaffRepository;
    private readonly classRepository: IClassRepository;

    constructor({ staffRepository, classRepository }: Dependencies) {
        this.staffRepository = staffRepository;
        this.classRepository = classRepository;
    }

    async execute(userId: string): Promise<MyClassResponseData[]> {
        const staff = await this.staffRepository.findByUserId(userId);

        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        const assignments = await this.classRepository.findStaffAssignments(staff.id);

        const grouped = new Map<string, MyClassResponseData>();

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

        return Array.from(grouped.values());
    }
}