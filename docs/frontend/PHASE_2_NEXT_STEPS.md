# Phase 2 — where we stopped and what to do next

> Hand-off file. Update it at the end of every milestone step so another developer can continue.
> **Last updated:** 2026-11-07 · **Repo:** `younghustler252/multi-school-portal` · **App:** `apps/web`

## Branches (in order; each is one step on top of the previous)

| Branch | Head | State |
|---|---|---|
| `refactor/modules` | `4883753` | Integration branch. Does **not** contain M0 or M1 yet. |
| `phase2/m0-boot` | `e7d2064` | M0 done and pushed (boot baseline, API origin fix, contracts wiring, Vitest). 15 tests pass on the owner's machine. |
| `phase2/m1-session` | see `git log` | M1 on top of M0 (one feature commit + this doc). Written, **not yet run** against the real API. |

Do not rebase or squash M0 after M1 exists without rebasing M1 onto the result.

## Do next, in this order

1. **Close M0.** Run `npm run typecheck:web 2>&1 | tee docs/frontend/baseline/typecheck-2026-11-06.txt`, commit the file, and check the foundation-path grep in `PHASE_2_BASELINE.md` §3. Categories #6 (RHF/Zod resolver) and #11 (API response union) are undetermined until then. Then integrate `phase2/m0-boot` into `refactor/modules`.
2. **Bring M1 forward** (rebase/merge onto the updated `refactor/modules`), then run:
   - `npm run test:web` — expect the earlier 15 plus M1's tests. `tests/auth/auth-store.test.ts` has **never been run**.
   - `npm run typecheck:web` — compare to the 32-error baseline; any new error in a file M1 touched is an M1 bug.
3. **M1 exit check: real login against the local API** (API on :5000, web on :3000). Try a school user, a platform user, a user with several personas, a user with several schools, a user who must change password, an unverified user. Record results here.
4. Decide whether M1 is integrated.
5. Only then start **M2** (below).

## What M1 contains (summary)

- Typed `ApiError`, single-flight refresh (refreshes on `TOKEN_EXPIRED` **and** `TOKEN_MISSING`), session-ended handler that clears the store and React Query cache.
- Session state machine (`src/lib/auth/session-reducer.ts`), store (`src/stores/auth.store.ts`), nothing persisted in the browser, bootstrap = `/users/me` + `/users/me/permissions` together.
- Shared login flow for `/login`, `/portal-login`, `/admin-login` (`features/auth/hooks/use-login.ts`).
- `SessionGate` replaces role guards in the layouts; nav and buttons come from permissions (`lib/nav-model.ts`, `lib/use-access.ts`); new `/home` page.

## Open / unresolved (do not treat as decided)

- **School selection (UNRESOLVED).** M1 sends the user to the chosen school's `url` and they log in again there. This is an inference. Verify the real backend contract (what `url` is, whether a session or ticket carries over) before relying on it.
- Web-local auth/session types (`src/lib/auth/session-types.ts`) vs extending `@schoolos/contracts` (API-004). Contract gaps are listed in `PHASE_2_BASELINE.md` §5.
- Fee "waive" buttons use a guessed permission key (`fees.adjustments.approve`). Confirm in the fees phase.
- Onboarding layout still runs queries before the gate decides (pre-existing).
- 32 business-module type errors are intentionally untouched; each belongs to its feature phase.

## M2 scope (not started)

TENANT-001..003, API-003, AUTH-004..006 remainder: tenant/host handling, persona and school switching UI, destination resolution, custom domains, hard-coded origins (`lib/subdomain-url.ts`, `impersonate-button.tsx`, `documents-gate-step.tsx`, `get-subdomain.ts`).
**Middleware cookie fix:** `middleware.ts` treats the `accessToken` cookie as "signed in", so after 15 minutes protected routes bounce to `/login` although the refresh cookie is valid. Needs deployment answers: same host for web and API with an `/api` proxy? cookie domain?

## M3 scope (not started)

AUTHZ-002/003: route guards per feature, nav cleanup of the old role-named route folders (`/school-admin`, `/teacher`, …). Separate tracks: `middleware.ts` → `proxy.ts` (Next 16 deprecation); re-pointing each feature at its API contract.

## How to verify without npm access

Pure logic can run under Node 22 type stripping; anything importing axios/zustand/React needs a real `npm install` and Vitest.
