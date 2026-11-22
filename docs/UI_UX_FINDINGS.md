# Findings outside the UI/UX redesign scope

Raised while working on `feature/ui-ux-redesign` (PR #63). **None of these are fixed by the redesign** unless a "Redesign mitigation" is listed, and every mitigation is presentation-only and easy to remove. Owners are recommendations; you decide the assignment.

How to read the evidence: paths are from the `refactor/web` tree at my base commit (`e2c80d6`) unless a branch is named. "Verified" means I read the code; "Not verified" means I did not run it or could not find it.

| ID | Title | Severity (my view) | Owner |
|---|---|---|---|
| BE-01 | Dashboard `people`, `academics`, `fees` ignore the viewer's scope | Medium (conditional on custom roles) | Backend |
| BE-02 | `people` is returned for `students.view` OR `staff.view` | Low-medium | Backend |
| BE-03 | `attendance.scope` and scoped attendance exist only on an unmerged branch | Medium until merged | Backend |
| BE-04 | Avatar upload can store an empty `photoUrl` | Medium for UX, config-dependent | Backend (+ ops) |
| BE-05 | No endpoint lists the user's schools (no in-app school switcher) | Product decision | Backend + product |
| BE-06 | Dashboard lacks trends and actionable lists | Feature gap | Backend |
| BE-07 | `school.verificationStatus` values not in the shared contract | Low | Backend |
| FE-01 | Dashboard response type was duplicated in web and had drifted from the API | Medium (fixed for one type only) | Frontend logic |
| FE-02 | Setup-checklist request fired without the permission behind it | Low (fixed for the dashboard) | Frontend logic |
| FE-03 | Two different rules decide who sees the "finish setup" nudge | Low | Frontend logic + product |
| FE-04 | Attendance-rate definition changed on the dashboard; other places unaudited | Needs product sign-off | Frontend logic + product |
| FE-05 | `@tanstack/react-table` is a dependency with zero imports | Low | Frontend logic |

---

## Backend

### BE-01 Dashboard `people`, `academics` and `fees` ignore the viewer's scope
- **Affected:** `apps/api/src/modules/school/usecases/get-dashboard.usecase.ts` (lines 71-79); `…/repositories/school-tenant.repository.ts` (`peopleCounts` l.45, `academicCounts` l.53, `termInvoiceTotals` l.64); route `school.routes.ts` l.67.
- **Evidence (verified):** the three repository methods take no scope or branch argument and count the whole school. The use case only checks `can(key)`, never `scopeOf(key)`. `students.view` can carry `ALL | BRANCH | ASSIGNED | OWN` and `staff.view` `ALL | BRANCH | OWN` (module permission registries). Only attendance is filtered, and only on `fix/api/attendance-summary-scope` (see BE-03). `fees.view` scopes: not checked.
- **Why it is not exposed today (verified):** the route needs `school.dashboard.view`, and in `role-templates.registry.ts` only School Admin (grants all), Principal (`ALL`) and Bursar (`ALL`) hold it. It becomes reachable with a custom role that has `school.dashboard.view` plus a `BRANCH`/`ASSIGNED`/`OWN` scope on `students.view`, `staff.view` or `fees.view`. Not verified by running a custom role.
- **Expected:** a section is returned only when the viewer's scope for its permission is `ALL`, or the counts are filtered to the viewer's scope (the rule already applied to attendance: "never school-wide for someone narrower than ALL").
- **Redesign mitigation:** none possible; the frontend cannot know the scope of `people`/`fees`.

### BE-02 `people` is returned for `students.view` OR `staff.view`
- **Affected:** `get-dashboard.usecase.ts` l.71-72 (`showPeople = can("students.view") || can("staff.view")`).
- **Evidence (verified):** the Bursar template holds `students.view` (`ALL`) and `fees.view` but no `staff.view`, so a Bursar receives `totalStaff` / `activeStaff` / `totalGuardians`.
- **Expected:** staff counts only with `staff.view`, student and guardian counts only with the student permission (split `people`, or return per-field).
- **Redesign mitigation:** the dashboard shows the Students card and student meter only with `students.view`, and the Staff card and staff meter only with `staff.view` (`useAccess().can`). Remove once the API is fixed. Not verified: that `can()` ignores scope (it should only test that the permission is held).

### BE-03 `attendance.scope` and scoped attendance exist only on an unmerged branch
- **Affected:** `get-dashboard.usecase.ts` l.86 and `school-tenant.repository.ts` l.76 (`attendanceCountsBetween(start, end)` has no scope argument on `refactor/web`/`refactor/modules`). The fix is on `fix/api/attendance-summary-scope` (controller passes `attendanceViewWhere(access)` and `scope`; response gains `attendance.scope`).
- **Evidence (verified):** on `refactor/web` and `refactor/modules` the response has no `scope` and the counts are unfiltered for any holder of `attendance.view`.
- **Expected:** merge that branch (or equivalent) before the dashboard is relied on for narrower roles.
- **Redesign mitigation:** `SchoolDashboardData.attendance.scope` is typed optional and the UI shows coverage only when it is present (`ALL` "Whole school", `BRANCH` "Your branches", `ASSIGNED` "Your classes", `OWN` "Your own records"). When it is missing the UI says nothing about coverage.

### BE-04 Avatar upload can store an empty `photoUrl`
- **Affected:** `apps/api/src/modules/user/usecases/upload-avatar.usecase.ts` l.42-49; `apps/api/src/infrastructure/storage/supabase-storage.service.ts` l.25 and l.42-43; `apps/api/src/config/env.ts` l.51-52.
- **Evidence (verified by reading):** `upload()` returns `url = isPublicBucket ? getPublicUrl(...) : ""`, where `isPublicBucket` is `bucket === SUPABASE_PUBLIC_BUCKET`. The avatar use case passes no `bucket`, so it uses `SUPABASE_BUCKET`. If those two env values differ, the upload succeeds, `photoUrl` is saved as `""`, and no avatar is ever shown. Not verified: the values in any deployed environment.
- **Expected:** avatars are stored in a bucket that yields a loadable URL (or served through the API/signed URL), and the use case rejects an empty URL instead of saving it.
- **Redesign mitigation:** `PersonAvatar` treats `null`, `""` and a failed load as "no photo" and shows initials, so nothing breaks, but people will see initials where they uploaded a photo.

### BE-05 No endpoint lists the user's schools
- **Affected:** `apps/api/src/modules/auth/routes/*.ts`; web `features/auth/services/auth.api.ts` l.40 (`switchPersona`, no caller in the UI).
- **Evidence (verified):** auth routes expose login, refresh, logout, `switch-persona`, invites and impersonation exchange, and a name search found no "my schools"/memberships route. School context comes from the subdomain.
- **Expected:** if a school selector is wanted, an endpoint returning the caller's schools (id, name, subdomain/URL) and how switching works across subdomains. This is a product decision as much as an API one.
- **Redesign mitigation:** none; no school selector was built (see `docs/UI_UX_REDESIGN.md`). A persona switcher could be added to the user menu using the existing `switch-persona` call if you want it.

### BE-06 Dashboard lacks trends and actionable lists
- **Evidence (verified):** `GET /school/dashboard` returns point-in-time counts only: no attendance-over-time or collections-over-time series, no pending approvals, recent activity or upcoming events for administrators, no branch filter parameter.
- **Expected (for the dashboard to be "informative and actionable" per the brief):** at minimum a daily attendance series and a payments series for the current term; an approvals/recent-activity feed if wanted.
- **Redesign mitigation:** none; those panels are not built and are not faked.

### BE-07 `school.verificationStatus` values not in the shared contract
- **Affected:** `get-dashboard.usecase.ts` (`school.verificationStatus: string`); `packages/contracts`.
- **Expected:** a typed union so the UI can show an "unverified school" notice safely.
- **Redesign mitigation:** none; no banner shown.

---

## Frontend logic

### FE-01 Dashboard response type was duplicated in web and had drifted
- **Affected:** `apps/web/src/features/school/types/school.types.ts` (`SchoolDashboardData`); `packages/contracts/src/` (no dashboard type; files: auth, automation, errors, me-permissions, message-templates, platform, provisioning, report-cards, school-settings).
- **Evidence (verified):** the web type had `todayPresent…`, `totalInvoiced`, `defaulters`, non-null sections and non-null limits; the API returns `present/absent/late/excused/date`, `…Kobo` fields, `overdueInvoices`, nullable sections and nullable limits. The old page would have shown blanks or thrown for any role missing a section.
- **Expected:** shared response types live in `packages/contracts` and are imported by both sides; ideally a contract test catches drift.
- **Redesign mitigation:** PR #63 corrects this one type (and the one other consumer, `insights/overview`, with a minimal mapping fix). Other web types may have drifted too: **not audited**.

### FE-02 Setup-checklist request fired without the permission behind it
- **Affected:** `features/school/hooks/use-school.ts` (`useSetupChecklist`); API route `GET /school/setup-checklist` needs `school.update` (`school.routes.ts` l.68).
- **Evidence (verified):** the old dashboard called the hook for every viewer.
- **Redesign mitigation:** the hook takes an optional `enabled` (default `true`); the dashboard passes `me.can("school.update")`. Other callers: none found.

### FE-03 Two different rules decide who sees the "finish setup" nudge
- **Affected:** `components/layout/sidebar.tsx` (`FinishSetupLink` shown when `permissions.holdsEverything`) vs `app/(dashboard)/school/dashboard/page.tsx` (checklist card shown when `school.update` is held and setup is under 100%).
- **Evidence (verified):** a Principal has `school.update` but not `holdsEverything`, so sees the dashboard card but not the sidebar nudge. The sidebar rule predates the redesign and was preserved.
- **Expected:** one rule, decided by product.

### FE-04 Attendance-rate definition changed; other places unaudited
- **Affected:** `apps/web/src/lib/school-dashboard.ts` (`attendanceView`).
- **Evidence:** the old dashboard card used present / (present + absent). Per your review it is now (present + late) / (present + late + absent), excused excluded (tested).
- **Not audited:** whether teacher, class or report-card screens compute attendance rates and with which definition. If several exist they should share one function.

### FE-05 `@tanstack/react-table` is declared but never imported
- **Affected:** `apps/web/package.json` l.19.
- **Evidence (verified):** zero imports in `apps/web/src`; list pages hand-roll their tables. A Dependabot branch bumping it exists.
- **Expected:** decide whether to adopt it (Stage 4 data-table work will need to decide) or remove it.

---

## Notes that are not defects
- `formatNaira(kobo)` takes kobo (verified); the dashboard passes kobo fields.
- The original platform top bar never had notifications or account settings; the redesigned one keeps that.
- Text and UI-control contrast of the approved tokens was computed (see `docs/UI_UX_REDESIGN.md`, "Accessibility check").
