import { IClassRepository }  from "../../repositories/class.repository";
import { IStaffRepository }  from "../../../staff/repositories/staff.repository";
import { IUserRepository }   from "../../../auth/repositories/user.repository";
import { NotFoundError }     from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
}

export interface EnrichedClassSubject {
    classSubjectId: string;
    classId:        string;
    subjectId:      string;
    subjectName:    string;
    subjectCode:    string | null;
    staffId:        string;
    teacherName:    string;
}

export class GetClassSubjectsUseCase {
    private readonly classRepository: IClassRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly userRepository:  IUserRepository;

    constructor({ classRepository, staffRepository, userRepository }: Dependencies) {
        this.classRepository = classRepository;
        this.staffRepository = staffRepository;
        this.userRepository  = userRepository;
    }

    async execute(classId: string): Promise<EnrichedClassSubject[]> {
        const cls = await this.classRepository.findClassById(classId);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        const assignments = await this.classRepository.findClassSubjectsEnriched(classId);
        if (assignments.length === 0) return [];

        const staffIds = [...new Set(assignments.map(a => a.staffId))];
        const staffRecords = await this.staffRepository.findMany({ id: { in: staffIds } });

        const userIds = staffRecords.map(s => s.userId);
        const userRecords = await this.userRepository.findMany({ id: { in: userIds } });

        const userByStaffId = new Map(
            staffRecords.map(s => [s.id, userRecords.find(u => u.id === s.userId)]),
        );

        return assignments.map(a => {
            const user = userByStaffId.get(a.staffId);
            return {
                ...a,
                teacherName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Unknown",
            };
        });
    }
}