# SchoolOS Backend API Documentation

**As of this session.** This reflects everything designed/built/fixed in this conversation. Validate against the actual live codebase before treating any individual route signature as gospel — this is the most complete reference available, compiled across a very long build session, not generated from a live schema introspection.

---

## 1. Architecture Overview

**Pattern**: Multi-tenant SaaS, schema-per-school isolation on a single PostgreSQL instance.

- One **public** Postgres schema: platform-level data shared across all schools.
- One dedicated **tenant schema per school** (`school_<subdomain>`): each school's own students, staff, grades, fees, etc. — physically isolated from every other school.
- Two independent Prisma projects: `prisma/public.prisma` (migrated via `prisma.public.config.ts`) and `prisma/tenant.prisma` (migrated via `prisma.tenant.config.ts`). Tenant migrations are a **template**, copied into each school's schema by the provisioning worker — after any tenant migration, run `npm run migrate:apply-to-existing-schools` to roll it out to already-provisioned schools.

**Stack**: Node.js, Express, TypeScript, PostgreSQL, Prisma, BullMQ + Redis (background jobs, now in a **separate worker process** from the API), Awilix (dependency injection), Puppeteer (PDF generation).

**Request lifecycle**:
```
Request → helmet → CORS (regex-matched subdomain pattern) → rate limiter
  → express.json() [webhook route excluded, needs raw body]
  → optionalAuthenticate (populates req.user if token present)
  → resolveTenant (resolves subdomain → schoolId/tenantSchema, sets AsyncLocalStorage context)
  → validateTenantOwnership (cross-checks req.user.schoolId against resolved tenant)
  → route-specific middleware (authenticate, requireTenant, role guards, validate(dto))
  → controller → use case → repository → Prisma
```

**Tenant resolution**: subdomain-based. `greenfield.schoolos.app` → resolves to School "Greenfield," sets tenant context to `school_greenfield` schema. Base domain / `admin.` subdomain → `tenantSchema: "public"`, `schoolId: "PUBLIC"` sentinel.

**Known gotcha**: file uploads via `multer` can break the AsyncLocalStorage tenant context chain. Every upload route needs `reestablishTenantContext` middleware inserted immediately after `upload.single(...)`/`upload.array(...)`.

---

## 2. Database Structure

### Public schema (platform-level)

| Table | Purpose |
|---|---|
| `School` | One row per school tenant. `subdomain`, `schemaName`, `status` (pending/active/suspended/deactivated), `verificationStatus`, `schemaProvisionedAt` (null until post-approval provisioning completes) |
| `SchoolDocument` | Verification documents. `type` (cac_certificate/proprietor_id/waec_approval/ministry_approval/other), `idDocumentType` (nin/voters_card/drivers_license/international_passport), `idNumber` (**encrypted at rest**), `status` (pending/under_review/approved/rejected), `apiVerified`, `apiResponse` |
| `User` | All human accounts platform-wide (any role). `role` enum (super_admin/school_admin/principal/teacher/bursar/student/guardian), `mustChangePassword`, `isEmailVerified`, lockout fields |
| `Otp` | Email verification / password reset codes |
| `RefreshToken` | Active sessions, rotated on every refresh |
| `Invite` | Generic invite mechanism (token-based) — not currently used by staff/guardian creation (those create accounts inline), kept for future flows |
| `Plan` | Subscription plans. `features` (JSON, typed via `PlanFeatures` interface), `studentLimit`/`staffLimit` (null = unlimited), `monthlyPriceKobo`/`yearlyPriceKobo` |
| `Subscription` | One active subscription per school. `status` (trialing/active/past_due/suspended/cancelled/expired), `autoRenew`, `paystackAuthorizationCode` (for recurring card charges), `scheduledDowngradePlanId` (applied at period end by the expiry worker) |
| `BillingHistory` | Platform billing transactions (subscription payments) |
| `AuditLog` | System-wide audit trail. `actorType` (user/system/super_admin/webhook) |
| `PlatformNotification` / `PlatformNotificationRecipient` | School-admin-facing notifications (schoolId-keyed, not per-person) |
| `PlatformSettings` | Singleton config row — platform name, support email, grace periods, maintenance mode, announcement banner |
| `Feedback` | User-submitted bug reports/suggestions |

### Tenant schema (per school)

| Table | Purpose |
|---|---|
| `Staff` | Linked to `User` via `userId`. `role` (StaffRole), `designation`/`department` (display-only, not permission-related) |
| `Student` | `userId` nullable (login optional, gated by `SchoolSettings.allowStudentLogin`), `graduatedAt` (nullable — set by promotion, student record never deleted) |
| `Guardian` | `userId` set inline at creation (no separate invite step) |
| `StudentGuardian` | Join table, `relation` + `isPrimary` |
| `Class` | `classTeacherId` — **currently NOT term-scoped** (open gap, flagged for follow-up: needs a `ClassHomeroomAssignment` table for history) |
| `Subject` | `defaultTeacherId` — subject-level default teacher override |
| `ClassSubject` | **Term-scoped** (`@@unique([classId, subjectId, termId])`). `assignedVia`: manual / auto_subject_default / auto_homeroom — see Section 5 |
| `ClassProgression` | `fromClassId` (unique) → `toClassId` (nullable = terminal/graduates) |
| `Enrolment` | Student ↔ Class per term, `@@unique([studentId, termId])` |
| `Session` / `Term` | Academic calendar. Only one `isCurrent: true` term at a time |
| `Attendance` | Per student, per date |
| `Grade` | Per student/term/classSubject. `isPublished` gates student/guardian visibility |
| `GradingConfig` | Score-range → grade/remark mapping (WAEC A1-F9 default) |
| `ReportCard` | `status`: draft/generated/published/sent. `pdfUrl` is a **storage path**, not a real URL — always needs `getSignedUrl()` conversion before returning to a client |
| `FeeType` | Soft-delete only (`isActive`) |
| `FeeInvoice` | **Consolidated model** — one per student per term, `@@unique([studentId, termId])`. `paidKobo`/`balanceKobo`/`status` are **never stored**, always derived live from items + payments |
| `FeeInvoiceItem` | Per fee type, belongs to one `FeeInvoice` |
| `Payment` | Linked to `FeeInvoice`, optionally `Guardian`. `method` (paystack/flutterwave/bank_transfer/cash), `status`, `reference` |
| `SchoolNotification` / `SchoolNotificationRecipient` | Staff/student/guardian-facing notifications, per-recipient-per-channel rows |
| `SchoolSettings` | Singleton. Branding, report card template choice, `teachingModel` (homeroom/subject_specialist), `allowStudentLogin`, `admissionNumberFormat` |

---

## 3. Auth & Response Conventions

### Response envelope (every endpoint)
```json
{
  "success": true,
  "message": "Human-readable text",
  "data": { ... },
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0, "hasNext": false, "hasPrev": false }
}
```
Error responses:
```json
{
  "success": false,
  "message": "Human-readable text",
  "code": "STABLE_MACHINE_READABLE_CODE",
  "errors": { "field": "validation message" }
}
```
**Always match on `code`, never `message` text** — message wording can change.

### Auth model
- httpOnly, `sameSite: strict` cookies (`accessToken`, `refreshToken`). Host-only — no cross-subdomain sharing by design (each subdomain requires its own login; base-domain login works for onboarding/pending schools regardless of status).
- Login validates the account belongs to the resolved tenant **before** issuing tokens (fixed this session — was previously only checked after the fact on protected routes).
- `mustChangePassword: true` on the JWT blocks every route except `PUT /me/password` and logout, until cleared.
- Account lockout: `MAX_FAILED_LOGIN_ATTEMPTS` / `LOCK_DURATION_MINUTES` (verify actual current values in `auth.enums.ts`).

### Common error codes
`INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `ACCOUNT_LOCKED`, `EMAIL_NOT_VERIFIED`, `MUST_CHANGE_PASSWORD`, `PLAN_LIMIT_EXCEEDED`, `FEATURE_NOT_AVAILABLE`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, `DUPLICATE_RECORD`

---

## 4. Routes by Module

### Auth (`/api/v1/auth`) — base domain
| Method | Path | Notes |
|---|---|---|
| POST | `/register` | Creates School (pending) + User (school_admin). **No provisioning here** — happens post-approval. Returns `{ message, subdomain }` |
| POST | `/verify-email` | OTP-based |
| POST | `/resend-otp` | |
| POST | `/login` | Tenant-aware — validates account matches resolved school before issuing session |
| POST | `/refresh-token` | Rotates refresh token |
| POST | `/logout` | |
| POST | `/forgot-password` | Generic response regardless of email existence |
| POST | `/reset-password` | OTP-based, also clears `mustChangePassword` |
| POST | `/validate-invite` | Generic invite system (not currently used by staff/guardian creation) |

### User (`/api/v1/me`) — authenticated, self-scoped
`GET /`, `PUT /`, `PUT /password`, `POST /avatar`

### School (`/api/v1/schools`)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Own school profile, incl. `verificationStatus`, status fields |
| GET | `/public/:subdomain` | No auth — status check before subdomain is reachable |
| POST | `/me/documents` | Upload verification doc — may trigger auto-verification + auto-approval cascade |
| GET | `/me/documents` | `pdfUrl`/`fileUrl` signed-URL converted |
| POST | `/me/logo` | Public bucket |

### Super-admin school management (`/api/v1/super-admin/schools`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Enriched: `planId`, `planName`, `studentCount`, `mrrKobo` per row |
| GET | `/:id` | Same enrichment as list |
| GET | `/:id/documents` | |
| PATCH | `/:id/documents/:documentId/approve` | May cascade to school approval |
| PATCH | `/:id/documents/:documentId/reject` | |
| POST | `/:id/approve` | Merged verify+activate. Triggers provisioning + welcome notification |
| POST | `/:id/reject` | |
| PUT | `/:id/plan` | Admin override, not payment-gated |
| POST | `/:id/reset-admin-password` | |
| GET | `/:id/billing-history` | School↔platform money only, never fee invoices |
| GET | `/:id/activity` | Audit log, enriched with resolved actor names |
| POST | `/:id/impersonate` | Returns a one-time ticket (not the real token) + redirect URL |

### Platform settings (`/api/v1/platform-settings`)
`GET /` (public, no auth — needed pre-login) · `PUT /` (super_admin only)

### Students (`/api/v1/students`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Filters: `classId`, `gender`, `isActive`, `search`. Enriched with `className`, `attendancePercentage` |
| GET | `/:id` | Includes `guardians[]` |
| GET | `/me` | Self-service |
| POST | `/` | Auto-generates admission number if omitted (`SchoolSettings.admissionNumberFormat`) |
| POST | `/batch` | `{ ids: string[] }`, max 500 |
| POST | `/import` | CSV upload |
| POST | `/bulk-create` | JSON array, max 200, shares logic with `/import` |
| PUT | `/:id` |  |
| POST | `/:id/photo` | |

### Staff (`/api/v1/staff`)
| Method | Path | Notes |
|---|---|---|
| GET | `/`, `/:id` | |
| GET | `/:id/assignments` | Flat list, admin view |
| GET | `/my-classes` | **Split response**: `{ classesAsClassTeacher[], classesAsSubjectTeacher[] }` |
| POST | `/` | Creates User + Staff inline, `mustChangePassword: true` |
| PUT | `/:id` | |
| DELETE | `/:id` | Deactivate (soft) |
| PUT | `/:id/reactivate` | |

### Guardians (`/api/v1/guardians`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Enriched with `children[]` (firstName/lastName) |
| GET | `/:id` | Includes `students[]` |
| GET | `/my-children` | Self-service, includes `classId`/`className` |
| POST | `/` | `{ studentId, firstName, lastName, email, relation, isPrimary, ... }` — creates account inline if email is new, else links existing guardian |
| DELETE | `/:id/students/:studentId` | Unlink only, never delete the guardian record |

### Classes & Subjects (`/api/v1/classes`)
| Method | Path | Notes |
|---|---|---|
| GET | `/?termId=` | Enriched: `studentCount`, `classTeacherName`, `toClassId`/`toClassName` (progression) |
| GET | `/:id?termId=` | Single-class version of the above |
| POST | `/`, PUT `/:id`, DELETE `/:id` | |
| PUT | `/:id/class-teacher` | `{ staffId, termId }` — ⚠️ not yet term-scoped, see Known Gaps |
| GET | `/:id/subjects?termId=` | **Shows all subjects**, including unassigned (`staffId: null`) — not just existing `ClassSubject` rows |
| POST | `/:id/subjects` | `{ subjectId, staffId, termId }`, always `assignedVia: "manual"` |
| DELETE | `/:id/subjects/:classSubjectId` | Full unassign |
| PATCH | `/:id/subjects/:classSubjectId/clear-override` | Falls back to auto-resolution, distinct from delete |
| POST | `/:id/subjects/bulk-assign` | `{ staffId, subjectIds[] }` — "assign everything to one teacher" (School A pattern) |
| PUT | `/:id/progression` | `{ toClassId }` |
| POST | `/apply-teaching-defaults` | Bounded, admin-initiated re-resolution sweep |
| GET | `/subjects/all` | |
| POST | `/subjects` | `defaultTeacherId` optional |
| PUT | `/subjects/:id` | Triggers `auto_subject_default` recascade if `defaultTeacherId` changes |

### Enrolment (`/api/v1/enrolment`)
`GET /`, `POST /` (single), `POST /bulk`, `PUT /:id`, `GET /promotion-preview?termId=`, `POST /promote`

### Attendance (`/api/v1/attendance`)
`POST /` (single — now checks class-teacher-or-subject-teacher ownership), `POST /bulk`, `GET /`, `GET /summary/:studentId`, `GET /class-summary?classId=&termId=`, `GET /me` (student self-service), `GET /my-children` (guardian)

### Grades (`/api/v1/grades`)
`POST /` (checks exact `classSubjectId` staff ownership), `PUT /:id`, `GET /`, `POST /bulk`, `POST /publish`, `GET /grading-config`, `PUT /grading-config`, `GET /me`, `GET /my-children`

### Report Cards (`/api/v1/report-cards`)
| Method | Path | Notes |
|---|---|---|
| POST | `/` | Single, synchronous |
| POST | `/bulk` | **Async** — returns `{ message, jobId }`, poll `/bulk-status/:jobId` |
| GET | `/bulk-status/:jobId` | |
| GET | `/:id` | `pdfUrl` signed-URL converted |
| GET | `/me`, `/my-children` | Only `published`/`sent` status visible |
| GET | `/preview/:studentId?termId=` | **Raw PDF response**, on-demand render, nothing saved — real data, no placeholder mockup |
| GET | `/template-previews/:name.png` | Static, mounted before auth middleware (no tenant/auth needed) |

### Fees (`/api/v1/fees`)
| Method | Path | Notes |
|---|---|---|
| GET | `/types`, POST `/types`, PUT `/types/:id`, DELETE `/types/:id` | Delete = soft (`isActive: false`) |
| POST | `/invoices` | Single student, `{ studentId, termId, items[], dueDate?, note? }` |
| POST | `/invoices/copy-from-class` | `{ studentId, classId, termId }` — copies an existing classmate's invoice template, for late enrollees |
| POST | `/invoices/class` | Whole class |
| POST | `/invoices/bulk` | Explicit student ID list |
| GET | `/invoices?classId=&termId=&status=` | Enriched: `studentName`, `className`, `termName`, item breakdown |
| GET | `/invoices/:id` | |
| PUT | `/invoices/:id` | `discountKobo`/`dueDate`/`note` only |
| PATCH | `/invoices/:id/waive` | Separate from general update, audit-worthy action |
| GET | `/invoices/:id/payments` | Per-invoice payment history |
| PUT | `/invoice-items/:id`, DELETE `/invoice-items/:id` | Delete blocked once any payment exists on the parent invoice |
| GET | `/defaulters?termId=` | Aggregated per-student (`studentId`, `studentName`, `totalOwedKobo`, `invoiceCount`), not flat invoices |
| POST | `/defaulters/ping` | Explicit admin-triggered notification send |
| GET | `/me/invoices` | Student self-service |
| GET | `/my-children/invoices` | Guardian self-service, multi-child |

### Payments (`/api/v1/payments`)
| Method | Path | Notes |
|---|---|---|
| POST | `/initialize` | `{ invoiceId, amountKobo?, callbackUrl }` — amount optional, defaults to full balance, server-capped |
| GET | `/verify/:reference` | Redirect-based confirmation path |
| POST | `/webhook` | ⚠️ **Must be mounted with `express.raw()` before the global JSON parser** — signature verification needs raw bytes |
| GET | `/:id` | Staff/admin receipt view, enriched with payer/student/school names |
| GET | `/my-payments` | Guardian self-service |

### Subscriptions (`/api/v1/subscriptions`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Own subscription |
| POST | `/initiate-payment` | Renamed from "upgrade" — handles first payment, upgrade, and renewal uniformly |
| POST | `/downgrade` | Scheduled for period end, not immediate |
| PUT | `/auto-renew` | `{ enabled }`, requires an existing card authorization code |
| GET | `/billing-history` | School's own view |
| GET | `/super-admin/stats` | active/trialing/pastDue/expired/onFreePlan counts |
| GET | `/super-admin/stats/mrr-trend?months=6` | Revenue-collected-per-month (not true MRR snapshot — flagged limitation) |
| GET | `/super-admin/all?status=` | Enriched with `planName`/`schoolName` |

### Notifications (`/api/v1/notifications`)
`GET /school`, `POST /school` (admin broadcast — now actually creates recipient rows + queues delivery, fixed this session), `GET /platform`, `POST /platform` (super_admin), `GET /me` (role-aware: platform notifications for school_admin, school notifications for everyone else), `PATCH /:id/read`, `PATCH /me/read-all`

### Audit (`/api/v1/audit`)
`GET /my-organization` (school_admin, self-scoped via `req.schoolId`)

### Feedback (`/api/v1/feedback`)
`POST /` (any authenticated user), `GET /super-admin` (list/filter), `PATCH /super-admin/:id` (status/response)

### Sessions/Terms (`/api/v1/sessions`)
`GET /`, `POST /`, `GET /current`, `POST /terms`, `PUT /terms/:id`, `PUT /terms/:id/set-current` (triggers enrolment + ClassSubject carry-forward), `GET /calendar-events`, `POST /calendar-events`

---

## 5. Key Business Rules Worth Remembering

1. **Invoice totals are never stored** — always `sum(items) - discount - sum(successful payments)`, recomputed via `recalculateInvoiceStatus` after every item/payment change.
2. **ClassSubject resolution precedence**: manual (permanent once set) → subject default teacher → school's homeroom model → unassigned. Cascades only touch auto-tagged rows, never manual.
3. **Grades only visible to students/guardians when `isPublished: true`** — same for report cards (`status: published|sent` only).
4. **Session→session promotion is never automatic** — always preview → admin review/override → explicit commit, using the exact rows shown in the preview (never re-derived server-side at commit time).
5. **Downgrade**: scheduled for period end; existing records above the new plan's limit are grandfathered, never deleted; new creation blocked above the cap.
6. **No refunds** for standard cancellation; platform-failure refunds are manual/super_admin-only.
7. **Financial/audit records never hard-delete** — soft-delete or immutable.

## 6. Known Open Gaps (carry into next session)

- `Class.classTeacherId` is not term-scoped — no history, needs a `ClassHomeroomAssignment` table.
- `Student.graduatedAt` not yet added (students aren't lost on graduation, just not cleanly filterable).
- Rate limiting needs Redis-backed store for multi-instance correctness (`rate-limit-redis`) — confirm applied.
- MFA/2FA — deferred to Phase 2 by design.
- API docs (`swagger-jsdoc`) only partially annotated.
