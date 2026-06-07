# Project Brief — Multi-School Portal SaaS
> Living document. Update this file every time a new decision is locked in.
> Paste this into any new chat to give full context instantly.

---

## 1. Vision & Problem Statement

A multi-tenant School Management SaaS built for Nigerian schools (primary and secondary). The core problem is that Nigerian schools run everything on paper and disconnected spreadsheets — enrolment, attendance, grades, fees. This portal replaces all of that with one organised, digital system.

The school admin is the primary user. They get the most daily value. Everything is designed to reduce their workload and give them full visibility over their school.

---

## 2. Target Market

- **Geography**: Nigeria only (v1)
- **School level**: Both primary (ages 5–12) and secondary (ages 12–18)
- **Customer**: Individual schools that self-onboard (no sales-assisted onboarding for v1)

---

## 3. User Roles

| Role | Scope | Description |
|---|---|---|
| Super Admin | Platform-wide | The SaaS owner. Can manage all schools, impersonate any school admin, manage billing and plans. Lives in `public` schema. |
| School Admin | Per school | Sets up and manages their school. Full access to all modules within their schema. |
| Teacher | Per school | Manages classes, takes attendance, enters grades. |
| Student | Per school | Views their own timetable, grades, attendance, fee status. |
| Parent / Guardian | Per school | Views their child's report card, fee invoices, pays fees online. |

---

## 4. V1 Core Modules

### 4.1 Student Records & Enrolment
- Register new students (name, DOB, gender, guardian info, class, admission number)
- Assign students to classes per session/term
- Track enrolment history across sessions
- Upload/store student profile photo (Supabase Storage)

### 4.2 Attendance Tracking
- Daily or per-subject attendance marking by teachers
- Attendance per term view
- Admin sees school-wide attendance summary
- Exportable attendance report

### 4.3 Grades & Report Cards
- Teachers enter continuous assessment (CA) and exam scores
- System computes total, grade (Nigerian scale: A1–F9 default, overridable per school), position in class, and remarks
- Admin generates PDF report cards per student per term (stored in Supabase Storage)
- Report cards auto-sent to parents via email/SMS
- Parents can also log in and view online

### 4.4 Fee Management
- Admin creates fee invoices per student per term (tuition, levies, etc.)
- Parents pay online via Paystack or Flutterwave
- Manual bank transfer payments recorded by admin
- Outstanding balance tracking per student
- Payment receipts auto-generated and sent to parent
- Fee defaulters report for admin

---

## 5. Nigerian-Specific Context

### Academic Calendar
- **Session**: one academic year e.g. `2024/2025`
- **Terms**: 3 terms per session (First, Second, Third)
- All records (attendance, grades, fees) are scoped to a term within a session
- Portal must support both term-level and session-level views

### Grading System
- **Default**: Nigerian WAEC scale (A1–F9) applied to all schools out of the box
- **Override**: School admin can configure a custom grading scale in settings
- Primary schools typically use percentage + class position — configurable per school

| Score Range | Grade | Remark |
|---|---|---|
| 75–100 | A1 | Excellent |
| 70–74 | B2 | Very Good |
| 65–69 | B3 | Good |
| 60–64 | C4 | Credit |
| 55–59 | C5 | Credit |
| 50–54 | C6 | Credit |
| 45–49 | D7 | Pass |
| 40–44 | E8 | Pass |
| 0–39 | F9 | Fail |

### Payment Providers
- **Paystack** — primary (most common in Nigeria)
- **Flutterwave** — secondary option
- **Manual bank transfer** — admin records reference number and confirms payment manually
- Schools may use one or all; configurable per school

---

## 6. Architecture Decisions

### Multi-Tenancy Strategy
- **Pattern**: Shared PostgreSQL instance, separate schema per school
- **Tenant resolution**: Subdomain-based from day one (e.g. `greenfield.app.com`) → API gateway extracts subdomain → sets `search_path = school_greenfield` for every DB query in that request
- **Public schema** holds: `schools`, `subscriptions`, `plan_features`, `users` (global credentials), `audit_log`
- **Each school schema** holds: all school-specific tables (students, classes, staff, grades, attendance, fees, grading config, etc.)

### Account Creation Flow — Locked
- **Teachers**: always created by School Admin
- **Students**: always created by School Admin (includes guardian/parent info)
- **Parents**: School Admin creates the student record → system auto-generates a parent invite link → parent clicks link, self-registers, and is automatically linked to their child
- **No open self-registration** — every user enters the system through an admin action or invite

### Tenant Onboarding Flow
- School signs up (name, subdomain, admin email, password)
- Account created in `public.schools` + `public.users`
- Background job (BullMQ) provisions new schema, runs baseline migrations, inserts seed data (default grading scale, term structure)
- Admin lands on dashboard, ready to set up their school

### Pricing Model — Locked
- **Freemium** with hard student count limits
- Billing cycle: per term (aligns with Nigerian school budget cycles)

| Plan | Student Limit | Price |
|---|---|---|
| Free | Up to 50 students | ₦0 |
| Basic | Up to 200 students | ~₦15,000/term |
| Pro | Unlimited | ~₦35,000/term |

- Exact pricing TBD but structure is locked
- Plan limits enforced at the API layer when admin tries to enrol students

---

## 7. Tech Stack — Locked

### Backend (primary focus for now)
| Concern | Choice |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (access token + refresh token) |
| Background jobs | BullMQ |
| Email | Nodemailer |
| SMS | Termii (Nigerian SMS gateway) |
| Payments | Paystack SDK + Flutterwave SDK |
| File storage | Supabase Storage |
| Testing | Jest |
| API style | REST (OpenAPI/Swagger documented) |

### Frontend (later)
| Concern | Choice |
|---|---|
| Web | Next.js (React) |
| Mobile | React Native |

### Infrastructure (to be decided)
- Hosting: TBD (Railway / Render / AWS)
- CI/CD: TBD (GitHub Actions)

---

## 8. Project Structure (to be scaffolded)

```
/apps
  /api              ← NestJS backend
/libs
  /shared           ← shared types, DTOs, utils
/docs
  PROJECT_BRIEF.md
  ERD.md            ← (to be created)
  API_ROUTES.md     ← (to be created)
```

---

## 9. What's Next (in order)

- [ ] **ERD** — design all tables for public schema + school schema covering all 4 modules
- [ ] **Auth flow** — registration, login, JWT payload structure, role middleware, refresh token strategy
- [ ] **API route map** — every endpoint grouped by module and role
- [ ] **Project scaffold** — NestJS folder structure, Prisma setup, multi-schema config
- [ ] **Module 1: Enrolment** — first module to build and test end-to-end

---

## 10. Open Questions

All open questions from session 1 are resolved. ✅

| Question | Decision |
|---|---|
| URL / tenant resolution | Subdomain per school from day one |
| Account creation | Admin-first; parent self-registers via invite link |
| Pricing model | Freemium with student limits, billed per term |
| File storage | Supabase Storage |
| Grading scale | A1–F9 default, overridable per school |

---

*Last updated: session 2 — all open questions resolved, foundation fully locked.*
