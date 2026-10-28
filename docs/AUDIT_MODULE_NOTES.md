# Audit notes

## What happens when an audit write fails
Audit writes are best effort: a failed write never breaks the request (the change has already been saved, and the audit table lives in the shared schema, so the two cannot share one transaction). That is unchanged.

What is new: a failure is no longer only a console line. It is also sent to Sentry (`audit-failure-reporter.ts`), for both writers: `AuditService.log` (every module) and `AuthAuditService.record` (sign-in and security events).

- Tag `audit_failed=true`, plus `audit_source` (`audit` or `auth-audit`) and `audit_module` (for example `student`).
- Grouped as one Sentry issue per source and module, so an outage does not bury the inbox; the count and times still show.
- Sent: action, entity, entity id, school id, user id, request id. NEVER the old/new values, metadata, tokens or secrets.
- Reporting cannot throw; if Sentry is off (`SENTRY_DSN` not set) only the console line remains.

**To act on it:** in Sentry, add an alert rule on the tag `audit_failed:true` (any occurrence in production).

## Still open (a later decision)
A failed write is still a lost entry. For the most sensitive modules (money, grades, permissions), a proper outbox (save the entry in the same database as the change, then copy it to the audit table) would remove the loss. Not built: decide when the first sensitive module is reviewed for it.

## Tests
`tests/audit/audit-failure.test.ts`: the report contents; a failed write is reported with context and never thrown (both writers); nothing is reported on success; a broken reporter does not break the audit call. NOT run: a real Sentry delivery (no DSN here).
