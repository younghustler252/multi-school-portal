import { IUserRepository } from "../../auth/repositories/user.repository";
import { SYSTEM_ACTOR_LABELS } from "../../../shared/constants/system-actors";

export interface EnrichedAuditLogEntry {
    id:        string;
    actorType: string;
    actorId:   string | null;
    actorName: string;
    action:    string;
    entity:    string;
    entityId:  string | null;
    oldValue:  any;
    newValue:  any;
    ipAddress: string | null;
    metadata:  any;
    createdAt: Date;
}

interface Dependencies { userRepository: IUserRepository; }

export class AuditLogEnricherService {
    private readonly userRepository: IUserRepository;
    constructor({ userRepository }: Dependencies) { this.userRepository = userRepository; }

    async enrich(logs: any[]): Promise<EnrichedAuditLogEntry[]> {
        const realUserIds = [...new Set(
            logs.map(l => l.userId).filter((id): id is string => !!id && !SYSTEM_ACTOR_LABELS[id]),
        )];

        const users = realUserIds.length > 0
            ? await this.userRepository.findMany({ id: { in: realUserIds } })
            : [];
        const userById = new Map(users.map(u => [u.id, u]));

        return logs.map(log => {
            let actorName: string;

            if (log.userId && SYSTEM_ACTOR_LABELS[log.userId]) {
                actorName = SYSTEM_ACTOR_LABELS[log.userId];
            } else if (log.userId && userById.has(log.userId)) {
                const u = userById.get(log.userId)!;
                actorName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
            } else if (log.actorType === "system") {
                actorName = "System";
            } else {
                actorName = "Unknown";
            }

            return {
                id: log.id, actorType: log.actorType, actorId: log.userId, actorName,
                action: log.action, entity: log.entity, entityId: log.entityId,
                oldValue: log.oldValue, newValue: log.newValue,
                ipAddress: log.ipAddress, metadata: log.metadata, createdAt: log.createdAt,
            };
        });
    }
}