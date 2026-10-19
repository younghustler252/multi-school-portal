import { IAuditRepository } from "../repositories/audit.repository";
import { ActorType }        from "../domain/audit.enums";
import { RequestContext } from "../../../shared/context/request-context";

/*
|--------------------------------------------------------------------------
| AUDIT SERVICE
| Used by every module to record "who did what". Calls look the same as before:
|   await this.auditService.log({ userId, schoolId, action: "staff.created", entity: "Staff", entityId, newValue });
|
| What is new (automatic, no change needed in calling code):
|   module            taken from the action ("staff.created" -> "staff")
|   requestId         the id of the request that caused it (also returned to the browser as x-request-id)
|   ipAddress / userAgent / actorMembershipId   from the request context
|   impersonatedBy    when a platform person is acting as a school user, their id is added to metadata,
|                     so an action done during impersonation is never recorded as the school user's own
|   schoolId "PUBLIC" (the platform host) is stored as empty instead of failing the school link
| Explicit values always win over the automatic ones. Entries made by background jobs have no request,
| so they carry only what the job passes (use actorType: ActorType.SYSTEM and a SYSTEM_* userId).
|
| Logging never breaks the main request, but a failure is no longer silent: the reason is printed.
|--------------------------------------------------------------------------
*/

export interface LogParams {
    userId?:            string;
    schoolId?:          string | null;
    actorType?:         ActorType;
    actorMembershipId?: string | null;
    actorName?:         string;
    action:             string;
    entity:             string;
    entityId?:          string | null;
    module?:            string;
    requestId?:         string;
    oldValue?:          any;
    newValue?:          any;
    ipAddress?:         string;
    userAgent?:         string;
    metadata?:          any;
}

export class AuditService {
    private readonly auditRepository: IAuditRepository;

    constructor({ auditRepository }: { auditRepository: IAuditRepository }) {
        this.auditRepository = auditRepository;
    }

    async log(params: LogParams): Promise<void> {
        try {
            const ctx = RequestContext.get();
            const actorType = params.actorType ?? ActorType.USER;
            // A system/webhook entry must not be credited to whoever happened to make the request
            const inherit = actorType === ActorType.USER || actorType === ActorType.SUPER_ADMIN;

            const metadata = {
                ...(params.metadata && typeof params.metadata === "object" ? params.metadata : {}),
                ...(ctx?.impersonatedBy ? { impersonatedBy: ctx.impersonatedBy } : {}),
            };

            await this.auditRepository.create({
                userId:            params.userId ?? (inherit ? ctx?.userId : undefined) ?? null,
                actorMembershipId: params.actorMembershipId ?? (inherit ? ctx?.membershipId : undefined) ?? null,
                actorName:         params.actorName ?? null,
                schoolId:          params.schoolId && params.schoolId !== "PUBLIC" ? params.schoolId : null,
                actorType,
                action:            params.action,
                entity:            params.entity,
                entityId:          params.entityId ?? null,
                module:            params.module ?? params.action.split(".")[0] ?? null,
                requestId:         params.requestId ?? ctx?.requestId ?? null,
                oldValue:          params.oldValue ?? null,
                newValue:          params.newValue ?? null,
                ipAddress:         params.ipAddress ?? ctx?.ip ?? null,
                userAgent:         (params.userAgent ?? ctx?.userAgent ?? null)?.slice(0, 255) ?? null,
                metadata:          Object.keys(metadata).length ? metadata : null,
            });
        } catch (err) {
            // Never let audit logging crash the main request, but say why it failed
            console.error(`⚠️  Audit log failed (${params.action}): ${(err as Error).message}`);
        }
    }

    // ── Convenience methods (unchanged) ──────────────────────────────────
    async logLogin(params: { userId: string; schoolId: string | null; ipAddress: string }): Promise<void> {
        await this.log({ ...params, action: "user.login", entity: "User", entityId: params.userId });
    }

    async logCreate(params: { userId: string; schoolId: string | null; entity: string; entityId: string; newValue: any; ipAddress?: string }): Promise<void> {
        await this.log({ ...params, action: `${params.entity.toLowerCase()}.created` });
    }

    async logUpdate(params: { userId: string; schoolId: string | null; entity: string; entityId: string; oldValue: any; newValue: any; ipAddress?: string }): Promise<void> {
        await this.log({ ...params, action: `${params.entity.toLowerCase()}.updated` });
    }

    async logDelete(params: { userId: string; schoolId: string | null; entity: string; entityId: string; oldValue: any; ipAddress?: string }): Promise<void> {
        await this.log({ ...params, action: `${params.entity.toLowerCase()}.deleted` });
    }
}
