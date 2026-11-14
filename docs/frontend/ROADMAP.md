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
| M3c | One access table drives menu, `/home` and guards (STAFF persona + ASSIGNED-or-broader scope on staff pages; family/student menus); auth/public/onboarding paths in the registry; robots exact + descendant rules; platform logo upload (frontend side) | PR on top of #4 |

## Next (proposed order)
1. **M4 - make the typecheck a real gate.** Fix the 32 baseline type errors in 18 files, feature by feature (grades, staff/students forms, onboarding, report cards). Then `npm run typecheck:web` must stay at 0. (`middleware.ts` → `proxy.ts` done in M4b.)
2. **M5 - remove the last role-name code.** Done in M5: `types/roles.ts`, `lib/rbac.ts` and `ROLE_META` are deleted; Settings > Roles now reads `GET /roles` + `GET /permissions` live (needs `roles.view`) instead of a hard-coded matrix. **Still open (moved to M6, they are feature contracts):** staff create/edit/filter still send/choose a role *name* (`StaffRole`, `role-filter-pills`, `staff.schema.ts`); the super-admin users page has a hard-coded `ROLE_OPTIONS`; marketing `role-showcase`. Also open: action-level permission checks inside pages (buttons/forms), done per feature in M6 with `useAccess().can(...)`.
3. **M6 - per-feature contract alignment.** One feature at a time (students, staff, classes, attendance, grades, report cards, fees, payments, notifications) against `@schoolos/contracts` and the real API: types, error codes, scoped lists (OWN / ASSIGNED / BRANCH). A student dashboard and the teacher/principal/bursar dashboards get real content.
4. **M7 - real-environment verification (owner + VPS).** Seeded data and real logins on every persona; run `deploy/verify-host-forwarding.sh` on the VPS; set `TRUST_PROXY`; run `report:reserved-subdomains`; browser smoke tests (Playwright) for login -> school redirect -> home -> a guarded page.
5. **M8 - custom domains (needs backend first).** Set/verify a school domain, TLS `ask` endpoint, host-based public school info for branding, then the web changes (remembered portal, super-admin labels). See `DEPLOYMENT.md` section 8.
6. **M9 - UI/UX redesign** (deliberately after the foundation), then Netlify config if wanted.

## Backend asks (not mine to change; owner decides)
- **Platform logo upload (decided: Supabase, like the school logo).** Frontend is ready and calls `POST /platform/settings/logo`: multipart field `logo`, `platform.settings.manage`, JPEG/PNG/WebP only (SVG refused), 2 MB, stored in the public bucket (e.g. `platform/logos`), updates `logoUrl`, audited, responds with the updated platform settings (`logoUrl` set). Until it exists the upload button shows an error toast. Also consider dropping `logoUrl` from the `PUT /platform/settings` DTO so arbitrary URLs cannot be set; the web no longer sends it.
- **Upload responses (verified against the API 2026-11-13).** `POST /schools/me/logo` returns the updated school (`logoUrl`); `POST /school-settings/stamp|signature` return the updated settings (`stamp`, `signature`). The web read `res.data.url` for all three, which the API never sends; fixed with `lib/api/upload-result.ts`. **Still open:** the web calls `POST /school/settings/letterhead` for the letterhead, and the backend has no letterhead upload route (only stamp and signature). Not changed; owner decides whether to add it or drop the web call.
- Public platform fields the UI still hard-codes in `config/company.json`: tagline, description, social links, sales email, legal company name. Add to `GET /platform/settings` or accept them as static.
- Custom-domain set/verify, TLS `ask` endpoint, host-based public school info (`DEPLOYMENT.md` section 8).
- `request-context.middleware` documented "mount FIRST" but not mounted in `app.ts`.
- Confirm no student dashboard permission is intended (`school.dashboard.view` is STAFF-only).

## Known limits right now
- `app/layout.tsx` metadata (title, description, Open Graph) and the sitemap still use the built-in defaults: server-side metadata cannot call the API through the same-origin `/api/v1` proxy. The visible UI uses the live platform settings. The site address in those defaults comes from `NEXT_PUBLIC_BASE_DOMAIN`.
- **Route registry scope (`lib/routes.ts`):** every page the app serves, in every route group (auth, public, onboarding, school areas, platform). Not in it: API paths, `/api/*`, external links, and the privacy/terms addresses (those come from platform settings). Query strings are added at the call site. To rename a route: edit the registry and move the folder; `tests/lib/routes.test.ts` fails if they disagree or a page is unregistered. Who may open a page, and the menu, live in `lib/route-access.ts`.
- **Menus:** sections with headings (School, Teaching, Finance, Insights); every page is listed once. Teaching is shown only to sessions holding a teaching key at exactly ASSIGNED, and while it is shown School's Attendance/Grades/Report cards are hidden in favour of the Teaching versions. Finance has one entry (its overview) because `/finance/fees` and `/finance/payments` are the same pages as `/school/fees` and `/school/payments`. Insights are read-only overviews. The menu is always a subset of what the guard allows. Rules live in `lib/route-access.ts` (header comment explains the design).
- `/settings` is the personal account page (name, phone, password) and is open to every signed-in school persona by an explicit rule. Platform admins use `/setting`.
- Students have no inbox page: the bell shows a "not available for student accounts yet" message and makes no requests.
- `/contact`, `/privacy`, `/terms` remain separate follow-up work (owner agreed).
- **Dead links found, not changed:** the pricing card links to `/contact`, and `config/company.json` defaults point at `/privacy` and `/terms`; no such pages exist. They are replaced by platform settings values when the API provides them.
- `next.config.ts` still lists `*.supabase.co` for `next/image`, but nothing uses `next/image` any more (logos are plain images). Safe to remove when convenient.
