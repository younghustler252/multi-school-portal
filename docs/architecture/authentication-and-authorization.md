# Authentication and Authorization Architecture

> **Status:** Current source-checked architecture snapshot.
> **Source snapshot:** `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Security note:** This guide describes architecture boundaries; consult the current auth implementation and [Auth Audit](../AUTH_AUDIT.md) for findings and remediation status.

## Two independent access decisions

Authorization and subscription entitlements answer different questions:

- **Permissions and scopes** determine what an actor may do and which records they may access.
- **Plan entitlements, features and limits** determine what the school's subscription permits.

Do not treat a plan entitlement as a user permission, or a permission as proof that the subscription includes a feature.

## Permission realms and scopes

- School permissions are evaluated in the school realm.
- Platform permissions use the `platform.*` namespace.
- Record access can be constrained by scopes such as `ALL`, `BRANCH`, `ASSIGNED`, and `OWN`.
- Role names are not authorization authority. Route and use-case authorization must rely on the permission/access model, not hard-coded role-name checks.

The architecture test rejects legacy role-name guards and direct `req.user` authorization patterns.

## Registries

Permission, role, feature and entitlement registries live under:

`apps/api/src/foundation/`

Review the target synchronization command and environment before running registry or role synchronization. A registry definition in source does not prove that the corresponding grants have been synchronized into a particular database.

## Route-level enforcement

The application-level middleware establishes request context, but route-level middleware remains responsible for the relevant combination of:

- Authentication.
- Tenant requirements.
- Permissions and record scopes.
- Feature entitlements.
- DTO validation.

Do not infer endpoint access from a module's registration or from the frontend navigation state. The backend must enforce access independently.

## Security review reference

The [Auth Audit](../AUTH_AUDIT.md) records source-reviewed findings and follow-up statuses. Its findings are a security-review snapshot, not a guarantee that all issues are resolved or that runtime/deployment controls have been tested.

Before changing authentication or authorization, inspect the current implementation for token/session lifecycle, tenant membership revalidation, invitation handling, platform support actions, rate limiting and audit behavior.

## Related guides

- [System and monorepo architecture](system-and-monorepo.md)
- [Multi-tenancy and database architecture](multi-tenancy-and-database.md)
