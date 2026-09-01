import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { IUserRepository } from "../../../auth/repositories/user.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";

interface Dependencies {
    classRepository: IClassRepository;
    staffRepository: IStaffRepository;
    userRepository: IUserRepository;
    sessionRepository: ISessionRepository;
}

export interface EnrichedClass {
    id: string;
    name: string;
    level: string | null;
    capacity: number | null;
    classTeacherId: string | null;
    classTeacherName: string | null;
    studentCount: number;
    createdAt: Date;
}

export class GetClassesUseCase {
    private readonly classRepository: IClassRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly userRepository: IUserRepository;
    private readonly sessionRepository: ISessionRepository;

    constructor({
        classRepository,
        staffRepository,
        userRepository,
        sessionRepository,
    }: Dependencies) {
        this.classRepository = classRepository;
        this.staffRepository = staffRepository;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    async execute(termId?: string): Promise<EnrichedClass[]> {
        const resolvedTermId = termId ?? (await this.sessionRepository.findCurrentTerm())?.id ?? null;

        const classes =
            await this.classRepository.findAllClassesEnriched(resolvedTermId);

        if (classes.length === 0) return [];

        const teacherIds = [
            ...new Set(
                classes
                    .map(c => c.classTeacherId)
                    .filter(Boolean)
            ),
        ] as string[];

        let teacherNameByStaffId = new Map<string, string>();

        if (teacherIds.length > 0) {
            const staffRecords = await this.staffRepository.findMany({
                id: { in: teacherIds },
            });

            const userIds = staffRecords.map(s => s.userId);

            const userRecords = await this.userRepository.findMany({
                id: { in: userIds },
            });

            teacherNameByStaffId = new Map(
                staffRecords.map(s => {
                    const user = userRecords.find(
                        u => u.id === s.userId
                    );

                    return [
                        s.id,
                        user
                            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                            : "Unknown",
                    ];
                }),
            );
        }

        return classes.map(c => ({
            ...c,
            classTeacherName: c.classTeacherId
                ? teacherNameByStaffId.get(c.classTeacherId) ?? "Unknown"
                : null,
        }));
    }
}