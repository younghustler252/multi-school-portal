/*
| AUDIT OUTBOX (per school). Events written in a school transaction wait here until the relay copies them to the
| public AuditLog. See AuditOutboxRelay.
*/
export interface OutboxRow { id: string; payload: Record<string, any>; attempts: number }

export interface IAuditOutboxRepository {
    /** Adds an event. Joins the open school transaction, so it commits or rolls back with the change it records. */
    enqueue(id: string, payload: Record<string, any>): Promise<void>;
    /** Takes up to `limit` events nobody holds a live claim on (oldest first), marking them claimed until `leaseMs` pass. Safe to call from two workers at once. */
    claim(limit: number, leaseMs: number, token: string): Promise<OutboxRow[]>;
    /** Deletes delivered events, only if this token still holds them. */
    deleteClaimed(ids: string[], token: string): Promise<void>;
    /** Records that delivery of one event failed and lets it be claimed again. */
    recordFailure(id: string, token: string, error: string): Promise<void>;
}
