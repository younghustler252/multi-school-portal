# `entitlements` in `GET /api/v1/users/me/permissions`

No new route (operation counts unchanged). Types: `packages/contracts/src/me-permissions.ts` (`MyPermissions.entitlements`, `EntitlementFlag`, `accessOf(...).hasFeature`).

```json
"entitlements": {
  "modules.fees": true,
  "grading.custom": false,
  "students.max": { "allowed": true, "limit": 500 },
  "staff.max":    { "allowed": true, "limit": null },
  "storage.mb":   { "allowed": false, "limit": 0 }
}
```

Rules
- School sessions: an object. Platform sessions: `null`.
- Every known feature key is present (code registry plus any key the platform console added). A missing key never means "maybe".
- Yes/no features: `true`/`false`. Limit and quota features: `{ allowed, limit }`; `limit: null` = unlimited, `0` = not granted. No usage counts, prices, plan names or billing state.
- Values mirror the server's own gate (`EntitlementsService.checkFeature`, school overrides applied, expired overrides ignored, no live subscription = all false), so `false` here means `403 FEATURE_NOT_AVAILABLE` on the gated route.
- Features the platform has marked inactive (`isActive: false`, not offered yet) are reported as `false` even though the server does not enforce them (decision: predictable contract).
- Entitlements are cached for 30 s per school (the existing service cache), so a plan change can take up to 30 s to show.
- Errors are unchanged: 401 unauthenticated, tenant errors as before.
