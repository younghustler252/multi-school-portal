# Frontend roadmap (Phase 2: foundation first)

Updated 2026-11-12. Branch flow: feature branch -> `refactor/web` -> `refactor/modules` (owner approves the last step).
Rule for every milestone: UX guards only (the API authorizes), permission keys and scopes never role names, nothing deployment-specific hard-coded.

## Done
| | What | Where |
|---|---|---|
| M0 | Boot baseline, API origin fix, contracts wiring, Vitest | merged |
| M1 | API client, session state machine, login outcomes (incl. `SCHOOL_REDIRECT`), permission-based shell | merged |
| M2 | Host/tenant/deployment config, same-origin `/api/v1`, middleware cookie fix, deploy docs + proxy check script | merged (PR #2) |
| M3 | Per-page permission guards (staff, guardian/student with persona + OWN, principal/teacher/bursar) | PR #3 |
| M3b | One route registry (`lib/routes.ts`), role-named folders moved to feature routes, old paths redirect (308), platform name/logo/support/legal links from `GET /platform/settings` | this PR |

## Next (proposed order)
1. **M4 - make the typecheck a real gate.** Fix the 32 baseline type errors in 18 files, feature by feature (grades, staff/students forms, onboarding, report cards). Then `npm run typecheck:web` must stay at 0. Also migrate `middleware.ts` to Next's `proxy.ts` convention.
2. **M5 - remove the last role-name code.** `types/roles.ts`, `lib/rbac.ts`, `nav-config.ts` `ROLE_META`, role pickers still key on role names. Replace with permissions/persona; keep role NAMES only where the UI shows or edits tenant roles. Guard `/home` and `/settings` if they need it. Add action-level permission checks inside pages (buttons, forms) where missing.
3. **M6 - per-feature contract alignment.** One feature at a time (students, staff, classes, attendance, grades, report cards, fees, payments, notifications) against `@schoolos/contracts` and the real API: types, error codes, scoped lists (OWN / ASSIGNED / BRANCH). A student dashboard and the teacher/principal/bursar dashboards get real content.
4. **M7 - real-environment verification (owner + VPS).** Seeded data and real logins on every persona; run `deploy/verify-host-forwarding.sh` on the VPS; set `TRUST_PROXY`; run `report:reserved-subdomains`; browser smoke tests (Playwright) for login -> school redirect -> home -> a guarded page.
5. **M8 - custom domains (needs backend first).** Set/verify a school domain, TLS `ask` endpoint, host-based public school info for branding, then the web changes (remembered portal, super-admin labels). See `DEPLOYMENT.md` section 8.
6. **M9 - UI/UX redesign** (deliberately after the foundation), then Netlify config if wanted.

## Backend asks (not mine to change; owner decides)
- Public platform fields the UI still hard-codes in `config/company.json`: tagline, description, social links, sales email, legal company name. Add to `GET /platform/settings` or accept them as static.
- Custom-domain set/verify, TLS `ask` endpoint, host-based public school info (`DEPLOYMENT.md` section 8).
- `request-context.middleware` documented "mount FIRST" but not mounted in `app.ts`.
- Confirm no student dashboard permission is intended (`school.dashboard.view` is STAFF-only).

## Known limits right now
- `app/layout.tsx` metadata (title, description, Open Graph) and `robots.ts`/`sitemap` still use the built-in defaults: server-side metadata cannot call the API through the same-origin `/api/v1` proxy. The visible UI uses the live platform settings. The site address in those defaults now comes from `NEXT_PUBLIC_BASE_DOMAIN`, not a typed domain.
- Routes are named in `lib/routes.ts`. To rename one: edit that file and move the folder; `tests/lib/routes.test.ts` fails if they disagree or a page is unregistered.
