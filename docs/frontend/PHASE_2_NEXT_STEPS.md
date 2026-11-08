# Phase 2 — where we stopped and what to do next

> Hand-off file. Update it at the end of every milestone step so another developer can continue.
> **Last updated:** 2026-11-08 · **Repo:** `younghustler252/multi-school-portal` · **App:** `apps/web`

## Branches (in order; each is one step on top of the previous)

| Branch | Head | State |
|---|---|---|
| `refactor/modules` | `699beb0` | Integration branch. Contains M0 (merge `b71c52f`) plus later backend work (login school resolution, provisioning). Does **not** contain M1. |
| `phase2/m0-boot` | `f06a569` | M0 done and merged. Typecheck baseline saved (32 errors / 18 files, none on foundation paths). |
| `phase2/m1-session` | see `git log` | M1 (rebased by the owner onto the M0 merge), then `refactor/modules` merged in (no rewrite), then SCHOOL_REDIRECT. Not merged into `refactor/modules` yet: awaiting the real-login check and review. |

Never force-push these branches. Bring a branch forward by merging; the owner rewrote M1's history once already, so check `git ls-remote` before assuming a local copy is current.

## Do next, in this order

1. ~~Close M0~~ **Done 2026-11-07.** Typecheck saved, #6 and #11 located, no foundation blockers, M0 merged into `refactor/modules`.
2. ~~Bring M1 forward~~ **Done 2026-11-08** (merge of `refactor/modules` into `phase2/m1-session`). **Verified 2026-11-08 on the owner's machine (SCHOOL_REDIRECT included):** `npm run test:web` = 85/85 pass in 10 files; `npm run typecheck:web` = 32 errors in 18 files, identical to the baseline, none in M1 files.
3. **M1 exit check: real login against the local API** (the owner now has data) (API on :5000, web on :3000). Try a school user, a platform user, a user with exactly one eligible school (SCHOOL_REDIRECT), a user with several schools (SCHOOL_SELECTION_REQUIRED), a user with several personas, a user who must change password, an unverified user. Record results here.
4. Decide whether M1 is integrated.
5. Only then start **M2** (below).

## What M1 contains (summary)

- Login types come from `@schoolos/contracts` (`auth.ts`): four outcomes, `SCHOOL_REDIRECT` and `SCHOOL_SELECTION_REQUIRED` handled separately.
- Typed `ApiError`, single-flight refresh (refreshes on `TOKEN_EXPIRED` **and** `TOKEN_MISSING`), session-ended handler that clears the store and React Query cache.
- Session state machine (`src/lib/auth/session-reducer.ts`), store (`src/stores/auth.store.ts`), nothing persisted in the browser, bootstrap = `/users/me` + `/users/me/permissions` together.
- Shared login flow for `/login`, `/portal-login`, `/admin-login` (`features/auth/hooks/use-login.ts`).
- `SessionGate` replaces role guards in the layouts; nav and buttons come from permissions (`lib/nav-model.ts`, `lib/use-access.ts`); new `/home` page.

## Verified against the backend source

- **School selection (VERIFIED, 2026-11-07, by the repository owner reading the backend).**
  1. A platform-host login resolves like this (source: `packages/contracts/src/auth.ts`, `docs/backend/modules/auth.md`):
     - an active platform membership gets the platform session;
     - otherwise the user's **eligible schools** are worked out (school active, database built, and an ACTIVE tenant membership checked in that school's own schema; a school that errors is left out);
     - exactly one → `SCHOOL_REDIRECT { school }`; several → `SCHOOL_SELECTION_REQUIRED { schools, suggestedSchoolId }` (last used first); none → the same generic 401 "invalid credentials" as a wrong password (audit log: `no_eligible_school`).
     Both `SCHOOL_REDIRECT` and `SCHOOL_SELECTION_REQUIRED` are **different outcomes**; M1 handles them separately.
  2. These routing responses carry **no tokens and set no session cookies**.
  3. `url` is the school's base URL: its verified custom domain when it has one, otherwise `<subdomain>.<BASE_DOMAIN>`.
  4. `SCHOOL_REDIRECT`: M1 sends the browser straight to `school.url`. `SCHOOL_SELECTION_REQUIRED`: the user picks one (suggested school marked "Last used"), then the browser goes to its url. Both use `window.location.assign`, http/https only (`lib/auth/safe-url.ts`).
  5. The user **logs in again on the school host** with email and password.
  6. The backend resolves the tenant from the hostname, checks active membership, then issues the school session.
  Therefore: **no automatic token exchange, and platform cookies must not be assumed to authenticate the school session.** The second login is the contract, not a gap. M1 behaves this way; do not "improve" it. A seamless sign-in would need its own backend design (single-use, school-bound exchange code), not shared cookies or tokens in a URL. Unit-tested; still to be confirmed with a real login.

## Open / unresolved (do not treat as decided)

- Contract gaps (API-004): the login result is now shared, but its `AUTHENTICATED.user` is `unknown` (the web app declares the fields it reads in `LoginUser`), and the profile, error codes and pagination meta are still web-local. Contract gaps are listed in `PHASE_2_BASELINE.md` §5.
- Fee "waive" buttons use a guessed permission key (`fees.adjustments.approve`). Confirm in the fees phase.
- Onboarding layout still runs queries before the gate decides (pre-existing).
- 32 business-module type errors are intentionally untouched; each belongs to its feature phase.

## M2 progress (branch `phase2/m2-session`, from `refactor/modules` `a64fd4c`)

Done without needing deployment answers:
- **Middleware cookie fix:** `lib/route-guard.ts` (`decideRoute`, tested). A protected page loads with EITHER cookie (access lives 15 min, refresh 7 days, both `path: "/"`); `/login` only bounces away on a live access cookie, so a dead refresh cookie cannot cause a redirect loop. `/home` is now protected.
- **Impersonation fix:** the API returns `{ redirectUrl }` with a one-time `?ticket=`; the button used to read a non-existent `accessToken` and build `?token=undefined`. It now follows `redirectUrl` (http/https only) and `/impersonate-entry` reads `ticket`. Not tested against a real impersonation yet.

- **Deployment-aware configuration (2026-11-08):** `lib/deployment.ts` (env-driven host classification and link building, tested), `NEXT_PUBLIC_API_URL` override in `get-api-base-url.ts`, no hard-coded domains left, middleware treats custom domains like school hosts. Design, options and the backend conflicts are in `docs/frontend/DEPLOYMENT.md`.

- **Owner decisions recorded (2026-11-08, `DEPLOYMENT.md` §0):** same-origin `/api/v1` through one reverse proxy preserving Host; host-only cookies (`COOKIE_DOMAIN` unset); VPS first, Netlify later; root + `admin.` + `<school>.` + eventual custom domains; no `app.`/`api.` hosts.
- **Proxy verified in a sandbox** (`deploy/Caddyfile.example`, `deploy/verify-host-forwarding.sh`; see `DEPLOYMENT.md` §3a for exactly what was and was not tested). **Not yet run against the real API on the VPS.**
- Backend items (not changed): trust proxy, reserved labels (`DEPLOYMENT.md` §7). Custom-domain gaps: §8 (no way to set/verify a domain, no TLS ask endpoint, no host-based public school info).

**Owner direction (2026-11-08):** subdomain layout, hosting provider and domain stay configurable via env vars; placeholders only. The proposed `app.`/`api.` hosts conflict with host-based tenancy: see `DEPLOYMENT.md` §1.

## M2 scope (original list)

TENANT-001..003, API-003, AUTH-004..006 remainder: tenant/host handling, persona and school switching UI, destination resolution, custom domains, hard-coded origins (`lib/subdomain-url.ts`, `impersonate-button.tsx`, `documents-gate-step.tsx`, `get-subdomain.ts`).
**Middleware cookie fix:** `middleware.ts` treats the `accessToken` cookie as "signed in", so after 15 minutes protected routes bounce to `/login` although the refresh cookie is valid. Needs deployment answers: same host for web and API with an `/api` proxy? cookie domain?

## M3 scope (not started)

AUTHZ-002/003: route guards per feature, nav cleanup of the old role-named route folders (`/school-admin`, `/teacher`, …). Separate tracks: `middleware.ts` → `proxy.ts` (Next 16 deprecation); re-pointing each feature at its API contract.

## How to verify without npm access

Pure logic can run under Node 22 type stripping; anything importing axios/zustand/React needs a real `npm install` and Vitest.
