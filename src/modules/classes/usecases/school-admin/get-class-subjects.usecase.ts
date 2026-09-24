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

export interface EnrichedClassSubject {
    classSubjectId: string | null;
    classId:        string;
    subjectId:      string;
    subjectName:    string;
    subjectCode:    string | null;
    staffId:        string | null;
    teacherName:    string | null;
    termId:         string;
    assignedVia:    string | null;
}

export class GetClassSubjectsUseCase {
    private readonly classRepository:   IClassRepository;
    private readonly staffRepository:   IStaffRepository;
    private readonly userRepository:    IUserRepository;
    private readonly sessionRepository: ISessionRepository;

    constructor({
        classRepository,
        staffRepository,
        userRepository,
        sessionRepository,
    }: Dependencies) {
        this.classRepository   = classRepository;
        this.staffRepository   = staffRepository;
        this.userRepository    = userRepository;
        this.sessionRepository = sessionRepository;
    }

    async execute(
        classId: string,
        termId?: string,
    ): Promise<EnrichedClassSubject[]> {
        const resolvedTermId =
            termId ?? (await this.sessionRepository.findCurrentTerm())?.id;

        if (!resolvedTermId) {
            throw new NotFoundError("No current term set");
        }

        const cls = await this.classRepository.findClassById(classId);

        if (!cls) {
            throw new NotFoundError(ClassErrorMessage.NOT_FOUND);
        }

        const assignments =
            await this.classRepository.findClassSubjectsEnriched(
                classId,
                resolvedTermId,
            );

        if (assignments.length === 0) {
            return [];
        }

        // Only query staff for subjects that actually have a teacher.
        const staffIds = [
            ...new Set(
                assignments
                    .map(a => a.staffId)
                    .filter((id): id is string => id !== null),
            ),
        ];

        if (staffIds.length === 0) {
            return assignments.map(a => ({
                ...a,
                teacherName: null,
            }));
        }

        const staffRecords = await this.staffRepository.findMany({
            id: { in: staffIds },
        });

        const userIds = staffRecords.map(s => s.userId);

        const userRecords = await this.userRepository.findMany({
            id: { in: userIds },
        });

        const userByStaffId = new Map(
            staffRecords.map(staff => [
                staff.id,
                userRecords.find(user => user.id === staff.userId),
            ]),
        );

        return assignments.map(a => {
            const user = a.staffId
                ? userByStaffId.get(a.staffId)
                : null;

            return {
                ...a,
                teacherName: user
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : (a.staffId ? "Unknown" : null),
            };
        });
    }
}
