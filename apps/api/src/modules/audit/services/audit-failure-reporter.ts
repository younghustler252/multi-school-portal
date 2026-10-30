import { Sentry } from "../../../infrastructure/monitoring/sentry";

/*
|--------------------------------------------------------------------------
| AUDIT FAILURE REPORTER
| Audit writes are best effort: a failed write never breaks the request. But a lost entry must not be silent.
| Every failure is sent to Sentry with enough context to find out what was lost (which action, on what, for which
| school, in which request), tagged `audit_failed` so an alert rule can watch for it.
|
| Only identifiers go out: never the old/new values (they can hold personal data), tokens or secrets.
| Reporting itself must never throw, and it never replaces the console line the services already print.
|--------------------------------------------------------------------------
*/

export interface AuditFailureContext {
    source:    "audit" | "auth-audit";
    action:    string;
    entity?:   string | null;
    entityId?: string | null;
    schoolId?: string | null;
    userId?:   string | null;
    requestId?: string | null;
}

export interface AuditFailureReport {
    tags:        Record<string, string>;
    fingerprint: string[];
    extra:       Record<string, string | null>;
}

/** Pure: decides exactly what is sent. */
export function buildAuditFailureReport(ctx: AuditFailureContext): AuditFailureReport {
    const module = ctx.action.split(".")[0] || "unknown";
    return {
        tags:        { audit_failed: "true", audit_source: ctx.source, audit_module: module },
        fingerprint: ["audit-log-failed", ctx.source, module],   // one issue per module, not one per request
        extra: {
            action:    ctx.action,
            entity:    ctx.entity    ?? null,
            entityId:  ctx.entityId  ?? null,
            schoolId:  ctx.schoolId  ?? null,
            userId:    ctx.userId    ?? null,
            requestId: ctx.requestId ?? null,
        },
    };
}

/** An object (not a bare function) so tests can swap `report` for a spy. */
export const auditFailureSink = {
    report(err: unknown, ctx: AuditFailureContext): void {
        try {
            const r = buildAuditFailureReport(ctx);
            Sentry.captureException(err, { level: "error", tags: r.tags, fingerprint: r.fingerprint, extra: r.extra });
        } catch { /* reporting must never break the caller */ }
    },
};
