// GetSchoolActivityUseCase — super_admin, one school
import { IAuditRepository } from "../repositories/audit.repository";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { SYSTEM_ACTOR_LABELS } from "../../../shared/constants/system-actors";

interface Dependencies {
    auditRepository: IAuditRepository;
    userRepository: IUserRepository;
}

export class GetSchoolActivityUseCase {
    private readonly auditRepository: IAuditRepository;
    private readonly userRepository: IUserRepository;

    constructor({
        auditRepository,
        userRepository,
    }: Dependencies) {
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
    }

    async execute(
        schoolId: string,
        params: {
            page?: number;
            limit?: number;
        },
    ) {
        const result = await this.auditRepository.paginate({
            page: params.page ?? 1,
            limit: params.limit ?? 20,
            where: { schoolId },
            orderBy: { createdAt: "desc" },
        });

        const realUserIds = [
            ...new Set(
                result.data
                    .map((log) => log.userId)
                    .filter(
                        (id): id is string =>
                            !!id && !SYSTEM_ACTOR_LABELS[id],
                    ),
            ),
        ];

        const users =
            realUserIds.length > 0
                ? await this.userRepository.findMany({
                      id: { in: realUserIds },
                  })
                : [];

        const userById = new Map(
            users.map((user) => [user.id, user]),
        );

        const enriched = result.data.map((log) => {
            let actorName: string;

            if (
                log.userId &&
                SYSTEM_ACTOR_LABELS[log.userId]
            ) {
                actorName = SYSTEM_ACTOR_LABELS[log.userId];
            } else if (
                log.userId &&
                userById.has(log.userId)
            ) {
                const user = userById.get(log.userId)!;

                actorName =
                    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                    user.email;
            } else if (log.actorType === "system") {
                actorName = "System";
            } else {
                actorName = "Unknown";
            }

            return {
                id: log.id,
                actorType: log.actorType,
                actorId: log.userId,
                actorName,
                action: log.action,
                entity: log.entity,
                entityId: log.entityId,
                oldValue: log.oldValue,
                newValue: log.newValue,
                ipAddress: log.ipAddress,
                metadata: log.metadata,
                createdAt: log.createdAt,
            };
        });

        return {
            data: enriched,
            meta: result.meta,
        };
    }
}
