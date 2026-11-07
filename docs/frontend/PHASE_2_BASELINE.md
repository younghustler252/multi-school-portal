# Frontend Phase 2 — M0 baseline

> **Branch:** `refactor/modules` · **Recorded:** 2026-11-06 · **Scope:** the state of `apps/web` before any Phase 2 foundation work (M1+).
> The baseline numbers below were measured by the repository owner on their machine. The "where" and "blocks foundation" columns come from a **static search of the source, not from the compiler output** — see "Finishing the categorization".

## 1. Boot result

| Check | Result |
|---|---|
| `npm run dev:web` | Starts. Next.js 16.4.3 (Turbopack) on `http://localhost:3000`, ready in 586 ms. `GET /login` returns 200. |
| Next.js warning | The `middleware` file convention is deprecated in favour of `proxy.ts`. Does not prevent startup. **Tracked separately; not part of Phase 2 foundation work.** |
| Login against the local API | **Not yet confirmed.** This is the remaining exit criterion of the boot milestone (M1). |
| `npm run typecheck:web` | **32 errors in 18 files.** |

`next dev` does not typecheck, which is why the app starts while the typecheck is red. The errors block `next build` and the CI typecheck step (the web CI job is `continue-on-error` until the web app is brought up to date).

## 2. The 32 typecheck errors, by category

Rule for M0 and M1: **no business-module error is fixed just to lower the count.** Each category belongs to the phase that re-points that module at its backend contract.

| # | Category (from the compiler output) | Where (static search) | Blocks foundation? | Belongs to |
|---|---|---|---|---|
| 1 | `EnrichedInvoice` still uses `amountKobo` | school-admin fees `[id]` and payments pages, guardian fees and payments pages, bursar dashboard, `features/fees/*` | No | Fees |
| 2 | `PdfViewerButton` prop mismatch | callers pass `onClick`, `reportCardId`+`label`; component props differ (school-admin, guardian, teacher report-card pages) | No | Report cards |
| 3 | `useClassSubjects` now needs a second argument | school-admin and principal grades pages, `child-grades-table`, `student-grades-card` call it with one argument | No | Classes / Grades |
| 4 | `EnrichedClassSubject` property mismatches | `features/classes` (types, `class-subjects-section`, `class.api`) | No | Classes |
| 5 | Staff and student DTO mismatches | `features/staff`, `features/students` | No | Staff / Students |
| 6 | React Hook Form + Zod resolver type mismatch | `features/classes/components/create-class-dialog.tsx` (`capacity` is `unknown` through `zodResolver`) | No (not an auth form) | Classes |
| 7 | Popover trigger `asChild` | `school-admin/students/new/page.tsx` (this UI kit uses Base UI's `render`, not `asChild`) | No | Students |
| 8 | School settings DTO changes | `features/school` settings | No | School settings |
| 9 | Document status/type mismatches | `features/school` documents, super-admin document review, onboarding documents step | No (onboarding is out of Phase 2 scope) | School / Platform |
| 10 | Missing `feeApi.getMyInvoices` | `features/students/hooks/use-student-portal.ts` | No | Fees / Student portal |
| 11 | API response union not handled | `features/super-admin/components/reset-admin-password-button.tsx:18` (`res.data` read without checking `success`) | No | Platform / super-admin |

**Foundation-blocking: none.** Confirmed 2026-11-07 against the full compiler output (`baseline/typecheck-2026-11-06.txt`): zero errors on foundation paths. Categories #6 and #11 are now located (above). Also seen in the output: `readonly` designation options passed as `string[]` (staff forms), `DocumentType` export missing (`rejected-screen`), implicit `any` in `student/dashboard` (follows from #10); all business modules.

## 3. Finishing the categorization

Save the full output once, then check which errors sit on foundation paths:

```bash
mkdir -p docs/frontend/baseline
npm run typecheck:web 2>&1 | tee docs/frontend/baseline/typecheck-2026-11-06.txt

# errors on foundation paths (any hit here is a blocker for M1):
grep -E "^src/(lib/api|stores|types|middleware|lib/rbac|lib/nav-config|components/layout|features/(auth|user)|app/\((auth|dashboard|super-admin)\)/(layout|login|portal-login|admin-login))" \
  docs/frontend/baseline/typecheck-2026-11-06.txt
```

Commit the output file. M1 and later phases report their error count against it.

## 4. API origin and environment (done in M0)

- `NEXT_PUBLIC_API_HOST` was the only variable the web app reads (`NEXT_PUBLIC_ADMIN_SUBDOMAIN` is read but unused). It defaulted to `localhost:4000`, but `apps/api` listens on **5000**. The default is now `localhost:5000`.
- `apps/web/.env.local.example` is added, with a narrow `.gitignore` exception (`!.env*.example`). Real files (`.env`, `.env.local`, `.env.production`, …) remain ignored; this was checked with `git check-ignore`.
- The URL rule was extracted to a pure `apiBaseUrlFor()` so it can be tested. Behaviour is unchanged apart from the default port; the production branch is untouched.

**Still open for M2 (TENANT-001 / API-003), not changed in M0:**

- Production API origin derivation uses `https://`, but the `www` and platform-host branches use `http://`, and custom domains are not recognised.
- Hard-coded origins: `lib/subdomain-url.ts`, `features/super-admin/components/impersonate-button.tsx` and `features/school/components/onboarding/documents-gate-step.tsx` (`localhost:3000`, `schoolos.app`).
- `lib/get-subdomain.ts` hard-codes the `admin` subdomain instead of reading `NEXT_PUBLIC_ADMIN_SUBDOMAIN`.

## 5. Shared contracts (`@schoolos/contracts`)

Before M0 the package existed but the web app did not depend on it and imported nothing from it. Now:

- `apps/web/package.json` depends on `@schoolos/contracts`.
- `next.config.ts` sets `transpilePackages: ["@schoolos/contracts"]` because the package ships TypeScript source (`main: src/index.ts`).
- `tests/contracts/me-permissions.test.ts` imports it from the web app.

**Gaps found, to be decided in M1 under API-004** (not changed here: the API's parity test covers the contract and a change must go in the same pull request as its API counterpart):

1. `ErrorCodes` only lists newer domains (automation, notifications, settings, provisioning, report cards, `ROLE_NOT_ALLOWED`). It lacks the codes the web needs most: `TOKEN_MISSING`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `SESSION_INVALID`, `TENANT_MISMATCH`, `PERMISSION_DENIED`, `MUST_CHANGE_PASSWORD`, `PLAN_LIMIT_REACHED`, `FEATURE_NOT_AVAILABLE`, `SCHOOL_SETTING_UP`, `SCHOOL_INACTIVE`, `RATE_LIMITED`, …
2. `PaginationMeta` lacks `hasNext` / `hasPrev`, which the API sends.
3. `ApiError` has no `errors` (validation field map).
4. There are no auth/session types yet (login result union, session, profile). Decide whether they go into the contract or stay web-local.
5. `apps/api/tests/contracts/parity.test.ts` compares request schemas only; response types are not checked against the API.

## 6. Tests

Vitest is set up in `apps/web` (`npm run test:web` from the root, `npm test` in `apps/web`). Layout follows the API: `tests/<area>/*.test.ts`, explicit imports from the runner, no globals. CI runs the web tests **before** the typecheck so they report while the typecheck is red.

## 7. Dependency changes need a lockfile update

`package-lock.json` was not regenerated in M0. Run `npm install` at the repository root after applying the change and commit the updated lockfile; until then CI's `npm ci` will fail for the web job.
