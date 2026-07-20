import { IAuditRepository } from "../repositories/audit.repository";
import { ActorType }        from "../domain/audit.enums";

/*
|--------------------------------------------------------------------------
| AUDIT SERVICE
| Lightweight service used by other modules to log actions
| Import this anywhere you need to log — inject via Awilix
|
| Usage:
| await this.auditService.log({
|     userId:   req.user.id,
|     schoolId: req.user.schoolId,
|     action:   AuditAction.STAFF_CREATED,
|     entity:   "Staff",
|     entityId: staff.id,
|     newValue: staff,
|     ipAddress: req.ip,
| });
|--------------------------------------------------------------------------
*/

interface LogParams {
    userId?:    string;
    schoolId?:  string | null;
    actorType?: ActorType;
    action:     string;
    entity:     string;
    entityId?:  string;
    oldValue?:  any;
    newValue?:  any;
    ipAddress?: string;
    userAgent?: string;
    metadata?:  any;
}

export class AuditService {
    private readonly auditRepository: IAuditRepository;

    constructor({ auditRepository }: { auditRepository: IAuditRepository }) {
        this.auditRepository = auditRepository;
    }

    async log(params: LogParams): Promise<void> {
        try {
            await this.auditRepository.create({
                userId:    params.userId    ?? null,
                schoolId:  params.schoolId  ?? null,
                actorType: params.actorType ?? ActorType.USER,
                action:    params.action,
                entity:    params.entity,
                entityId:  params.entityId  ?? null,
                oldValue:  params.oldValue  ?? null,
                newValue:  params.newValue  ?? null,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
                metadata:  params.metadata  ?? null,
            });
        } catch {
            // Never let audit logging crash the main request
            console.error("⚠️  Audit log failed silently");
        }
    }

    // ── Convenience methods ───────────────────────────────────────────────
    async logLogin(params: {
        userId:    string;
        schoolId:  string | null;
        ipAddress: string;
    }): Promise<void> {
        await this.log({
            ...params,
            action: "user.login",
            entity: "User",
            entityId: params.userId,
        });
    }

    async logCreate(params: {
        userId:    string;
        schoolId:  string | null;
        entity:    string;
        entityId:  string;
        newValue:  any;
        ipAddress?: string;
    }): Promise<void> {
        await this.log({
            ...params,
            action: `${params.entity.toLowerCase()}.created`,
        });
    }

    async logUpdate(params: {
        userId:    string;
        schoolId:  string | null;
        entity:    string;
        entityId:  string;
        oldValue:  any;
        newValue:  any;
        ipAddress?: string;
    }): Promise<void> {
        await this.log({
            ...params,
            action: `${params.entity.toLowerCase()}.updated`,
        });
    }

    async logDelete(params: {
        userId:    string;
        schoolId:  string | null;
        entity:    string;
        entityId:  string;
        oldValue:  any;
        ipAddress?: string;
    }): Promise<void> {
        await this.log({
            ...params,
            action: `${params.entity.toLowerCase()}.deleted`,
        });
    }
}