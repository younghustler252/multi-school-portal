export enum ActorType {
    USER        = "user",
    SYSTEM      = "system",
    SUPER_ADMIN = "super_admin",
    WEBHOOK     = "webhook",
}

/*
| Action codes are a free-form "<module>.<verb>" string convention (e.g. "roles.created",
| "user.deactivated", "staff.deactivated"), passed directly to AuditService.log({ action, ... }) /
| AuthAuditService.record({ action, ... }). There used to be a canonical AuditAction enum here, but
| no call site ever imported or used it (every module always passed a raw string), and it had already
| drifted out of sync with the real action codes in use. Removed rather than left to rot further; if a
| closed catalog of action codes is wanted again, regenerate it from a repo-wide grep of actual
| `action: "..."` call sites rather than hand-maintaining a parallel list.
|--------------------------------------------------------------------------
*/