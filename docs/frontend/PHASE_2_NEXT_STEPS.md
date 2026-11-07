# Phase 2 — where we stopped and what to do next

> Hand-off file. Update it at the end of every milestone step so another developer can continue.
> **Last updated:** 2026-11-07 · **Repo:** `younghustler252/multi-school-portal` · **App:** `apps/web`

## Branches (in order; each is one step on top of the previous)

| Branch | Head | State |
|---|---|---|
| `refactor/modules` | `b71c52f` | Integration branch. **Contains M0** (merge commit). Does not contain M1. |
| `phase2/m0-boot` | `f06a569` | M0 done, merged into `refactor/modules`. Typecheck baseline saved (32 errors / 18 files, none on foundation paths). |
| `phase2/m1-session` | see `git log` | Branched from `e7d2064`, i.e. **before** M0's last docs commit and the merge. Needs bringing onto `refactor/modules` (merge it in; do not force-push the pushed branch without the owner's say-so). |

Do not rebase or squash M0 after M1 exists without rebasing M1 onto the result.

## Do next, in this order

1. ~~Close M0~~ **Done 2026-11-07.** Typecheck saved, #6 and #11 located, no foundation blockers, M0 merged into `refactor/modules`.
2. **Bring M1 forward** onto `refactor/modules`. Already measured on the owner's machine (M1 branch): `npm run test:web` = 78/78 pass; `npm run typecheck:web` = the same 32 errors / 18 files as the baseline, none in M1 files. Re-run both after the merge.
3. **M1 exit check: real login against the local API** (needs seeded data; the owner has none yet — create a school, a staff user and a platform user first) (API on :5000, web on :3000). Try a school user, a platform user, a user with several personas, a user with several schools, a user who must change password, an unverified user. Record results here.
4. Decide whether M1 is integrated.
5. Only then start **M2** (below).

## What M1 contains (summary)

- Typed `ApiError`, single-flight refresh (refreshes on `TOKEN_EXPIRED` **and** `TOKEN_MISSING`), session-ended handler that clears the store and React Query cache.
- Session state machine (`src/lib/auth/session-reducer.ts`), store (`src/stores/auth.store.ts`), nothing persisted in the browser, bootstrap = `/users/me` + `/users/me/permissions` together.
- Shared login flow for `/login`, `/portal-login`, `/admin-login` (`features/auth/hooks/use-login.ts`).
- `SessionGate` replaces role guards in the layouts; nav and buttons come from permissions (`lib/nav-model.ts`, `lib/use-access.ts`); new `/home` page.

## Verified against the backend source

- **School selection (VERIFIED, 2026-11-07, by the repository owner reading the backend).**
  1. A platform-host login can return `SCHOOL_SELECTION_REQUIRED` with `schools: [{ id, name, url }]`.
  2. Selection responses carry **no tokens and set no session cookies**.
  3. `url` is the school's base URL: its verified custom domain when it has one, otherwise `<subdomain>.<BASE_DOMAIN>`.
  4. Choosing a school sends the browser to that URL (M1: `window.location.assign`, http/https only).
  5. The user **logs in again on the school host** with email and password.
  6. The backend resolves the tenant from the hostname, checks active membership, then issues the school session.
  Therefore: **no automatic token exchange, and platform cookies must not be assumed to authenticate the school session.** The second login is the contract, not a gap. M1 already behaves this way; do not "improve" it. Still untested end to end because no seeded login data exists yet.

## Open / unresolved (do not treat as decided)

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
