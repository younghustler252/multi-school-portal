# `entitlements` in `GET /api/v1/users/me/permissions`

No new route (operation counts unchanged). Types: `packages/contracts/src/me-permissions.ts` (`MyPermissions.entitlements`, `EntitlementFlag`, `accessOf(...).hasFeature`).

```json
"entitlements": {
  "modules.fees": true,
  "grading.custom": false,
  "students.max": { "allowed": true, "limit": 500 },
  "staff.max":    { "allowed": true, "limit": null },
  "storage.mb":   { "allowed": false, "limit": 0 }
},
"entitlementsNotReady": ["api.access", "branches.multiple", "roles.custom.max", "security.two_factor", "sms.monthly_quota", "storage.mb"]
```

Rules
- School sessions: an object and a list. Platform sessions: both `null`.
- Every known feature key is present (code registry plus any key the platform console added). A missing key never means "maybe".
- Yes/no features: `true`/`false`. Limit and quota features: `{ allowed, limit }`; `limit: null` = unlimited, `0` = not granted. No usage counts, prices, plan names or billing state.
- Values mirror the server's own gate (`EntitlementsService.checkFeature`, school overrides applied, expired overrides ignored, no live subscription = all false), for every feature that is switched on.
- Two different things can make a flag `false`, and they are not the same:
  1. **Plan entitlement.** The feature is switched on but the plan (with overrides) does not grant it, or the school has no live subscription. A gated route answers `403 FEATURE_NOT_AVAILABLE`.
  2. **Readiness.** The feature is defined but not switched on yet (`FeatureDefinition.isActive = false`, "defined but not enforced yet" in the registry; the console owns this flag). The flag is `false` so the screen does not offer something unfinished, and the key is listed in `entitlementsNotReady`. The server does **not** enforce these: `checkFeature` allows them, so a route gated by one of them would not answer 403. Gate behaviour is unchanged by this change.
- **`WARN` enforcement.** Each feature has an enforcement mode set in the platform console: `BLOCK` (default) or `WARN`. For a `WARN` feature the server lets the school through even when its plan does not grant it (the request is allowed and the server only records a warning). Because the flags mirror the gate, such a feature shows `true`. So **`true` means "the school may use it", not "the plan explicitly includes it"**. If the web app ever needs to say "included in your plan", this response cannot tell it; it would need a separate, approved field. For limit features, the usage check (is the school over its cap?) is a per-request check that is not part of this response; `WARN` there likewise lets a request through over the cap.
- `true` therefore means both "the plan grants it" and "it is ready". `false` + key in `entitlementsNotReady` = not offered yet; `false` + key not in the list = not in the plan. The web app should treat both as "hide", and use the list only if it wants to say which kind of `false` it is.
- Entitlements are cached for 30 s per school (the existing service cache), so a plan change can take up to 30 s to show.
- Errors are unchanged: 401 unauthenticated, tenant errors as before.
