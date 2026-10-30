import { IUserRepository } from "../../auth/repositories/user.repository";
import { SYSTEM_ACTOR_LABELS } from "../../../shared/constants/system-actors";
import { EnrichedAuditLogEntry } from "../domain/audit.entity";

interface Dependencies { userRepository: IUserRepository }

/*
| ENRICHER: turns ids into names for display (one batched user lookup for a whole page).
| System actors show their label ("Billing system"); a person shows their name; a platform person who was
| impersonating shows both ("Ada Obi (as Tunde Bello)" is the convention: actor first, impersonator in its own field).
*/
export class AuditLogEnricherService {
    private readonly users: IUserRepository;
    constructor({ userRepository }: Dependencies) { this.users = userRepository; }

    async enrich(logs: any[]): Promise<EnrichedAuditLogEntry[]> {
        const ids = new Set<string>();
        for (const l of logs) {
            if (l.userId && !SYSTEM_ACTOR_LABELS[l.userId]) ids.add(l.userId);
            if (l.metadata?.impersonatedBy) ids.add(l.metadata.impersonatedBy);
        }
        const people = await this.users.findByIds([...ids]);
        const byId = new Map(people.map(u => [u.id, u]));
        const nameOf = (id: string | null | undefined): string | null => {
            if (!id) return null;
            if (SYSTEM_ACTOR_LABELS[id]) return SYSTEM_ACTOR_LABELS[id];
            const u = byId.get(id);
            return u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email) : null;
        };

        return logs.map(l => ({
            id: l.id, actorType: l.actorType, actorId: l.userId,
            actorName: nameOf(l.userId) ?? (l.actorType === "system" ? "System" : "Unknown"),
            impersonatedByName: nameOf(l.metadata?.impersonatedBy),
            action: l.action, module: l.module ?? null, entity: l.entity, entityId: l.entityId,
            oldValue: l.oldValue, newValue: l.newValue, ipAddress: l.ipAddress, requestId: l.requestId ?? null,
            metadata: l.metadata, createdAt: l.createdAt,
        }));
    }
}
