import { IClassRepository }   from "../../repositories/class.repository";
import { IStaffRepository }   from "../../../staff/repositories/staff.repository";
import { IUserRepository }    from "../../../auth/repositories/user.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }  from "../../domain/class.enums";

interface Dependencies {
    classRepository:   IClassRepository;
    staffRepository:   IStaffRepository;
    userRepository:    IUserRepository;
    sessionRepository: ISessionRepository;
}

export interface EnrichedClass {
    id:               string;
    name:             string;
    level:            string | null;
    capacity:         number | null;
    classTeacherId:   string | null;
    classTeacherName: string | null;
    studentCount:     number;
    createdAt:        Date;
}

export class GetClassByIdUseCase {
    private readonly classRepository:   IClassRepository;
    private readonly staffRepository:   IStaffRepository;
    private readonly userRepository:    IUserRepository;
    private readonly sessionRepository: ISessionRepository;

    constructor({ classRepository, staffRepository, userRepository, sessionRepository }: Dependencies) {
        this.classRepository   = classRepository;
        this.staffRepository   = staffRepository;
        this.userRepository    = userRepository;
        this.sessionRepository = sessionRepository;
    }

    async execute(id: string, termId?: string): Promise<EnrichedClass> {
        const resolvedTermId = termId ?? (await this.sessionRepository.findCurrentTerm())?.id ?? null;

        const cls = await this.classRepository.findClassByIdEnriched(id, resolvedTermId);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        let classTeacherName: string | null = null;

        if (cls.classTeacherId) {
            const staff = await this.staffRepository.findById(cls.classTeacherId);
            if (staff) {
                const user = await this.userRepository.findById(staff.userId);
                classTeacherName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Unknown";
            }
        }

        return { ...cls, classTeacherName };
    }
}