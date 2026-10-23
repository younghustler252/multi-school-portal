# Guardians Module Audit & Refactor Plan

> Branch `refactor/modules`, commit `2e5f907` (Students pass applied). Source inspection only: no code changed, no build or test run for this document. Recheck against the working tree before implementing.

## 1. Decision
Guardians is the next module. Do not enable it by uncommenting the container and route. Its invite flow does not work, its create flow uses the old login model, and it has no permissions of its own. Recommended first slice: a permission-protected guardian record (create with link, get, list, update, link, unlink, invite through Auth, "my children"), with audit, strict validation and tests.

## 2. Confirmed findings

### Does not work / does not compile
1. `registerGuardians` and the `/guardians` mount are commented out.
2. `invite-guardian` and `bulk-invite-guardian` use `env.APP_BASE_DOMAIN`, which does not exist (2 build errors; the variable is `BASE_DOMAIN`).
3. **Invites cannot be accepted.** Both use cases make a token and email a link, but never save an `Invite` row. Auth looks the token up in `invites`, so every link is dead. They also build the URL by hand (`https://`, "7 days" typed in) instead of using Auth's invite service.
4. Unlink: the use case and repository method exist and the container registers the use case, but the controller and routes have no unlink endpoint.

### Security and privacy
5. Routes use `requireStaff` and `requireSchoolAdmin`. There are no guardian permissions. Any staff member (including a teacher with a custom role) can list every guardian's email and phone and open any guardian.
6. `GET /guardians/me/children` has no persona check; any signed-in person reaches the use case.
7. `getChildStudentIds` in the repository has a `console.log("student links", links)` that writes student ids to the logs. Other modules call this method.
8. Create guardian makes a login with `Math.random()` (not secure), emails the password in plain text, marks the email verified without checking it, and has "SchoolPortal" typed into the email. It also needs `Role` and `User.schoolId`, which are being removed.

### Data consistency
9. Create is three separate writes (public login, guardian, link) with no recovery. A failure in the middle leaves an orphan login or a guardian with no student.
10. Email matching is case-sensitive and emails are not lowercased, so "Mum@x.com" and "mum@x.com" become two guardians. The table has no index on email.
11. Several primary guardians can exist for one student; nothing enforces one.
12. Update changes the guardian's email even when the guardian has a login, so the guardian record and the login email drift apart.
13. Link and unlink have no audit and no transaction; a double click gives a raw duplicate-key error.
14. Create, update, link and unlink write no audit entries (only the first-time create does).

### Validation and queries
15. DTOs are not strict; phone, occupation and address are unbounded; emails are not trimmed or lowercased; the list query is string-based and unbounded (`limit=100000` works); `studentId` in the query is not checked as an id; the update body may be empty; optional fields cannot be cleared.
16. List by student: unpaginated and loads each guardian one by one. Get guardian: loads each child one by one, ignores student visibility, and after the Students pass the child's `photoUrl` is always null (needs `StudentPhotoService`).
17. `GetMyChildren` needs Enrolment, Sessions and Classes repositories, which are not registered.
18. No guardian deactivate or reactivate, even though `isActive` exists.
19. No tests for this module.

### Other modules depend on it
`guardianRepository` is used by attendance, grades, report-cards, payments (verify) and five notification files. Its method names must stay the same: `findById`, `findByUserId`, `findByEmail`, `isLinked`, `linkToStudent`, `findStudentLinksByGuardianId`, `getChildStudentIds`, `isGuardianOfStudentByUserId`, `paginate`.

## 3. Reference: what already works in Auth
Auth's `SendInviteUseCase` already supports persona GUARDIAN with `personaEntityId`: it saves a hashed, expiring invite, sends the email from templates, refuses someone who is already a member, and on acceptance links the new login to the guardian record and gives the locked Guardian role. Staff already uses it through `InviteStaffUseCase`. Guardians should do the same.

## 4. Proposed first slice

**In scope**
- Permissions `guardians.view` (ALL) and `guardians.manage` (ALL) in `guardians.permissions.ts`, added to the registry.
- Create a guardian record and link it to a student in ONE transaction. Reuse an existing guardian with the same email (case-insensitive). No login is created. Optional `invite: true` sends the portal invitation through Auth; if that fails the guardian is still saved and the response says so.
- Get (children loaded in one query, photos through `StudentPhotoService`), list (paginated, search by name, email or phone, filter by student, active filter), update (audit, only changed fields, email change refused when the guardian has a login), link (one primary per student, audit), unlink (new endpoint, audit).
- Invite and bulk invite rewritten to call Auth's `SendInviteUseCase`; bulk reports sent, skipped and failed per guardian.
- `GET /guardians/me/children` limited to the GUARDIAN persona; class names stay out until Enrolment is on.
- Strict DTOs, shared error codes, audit entries, container and route wiring, unit tests, notes.

**Deferred**
Class and attendance details on "my children", guardian deactivate/reactivate, a guardian editing their own contact details, pickup authorization, contact preferences, duplicate-guardian merge, an email index (needs a tenant migration).

**Non-goals**
Changes to Auth, Students, Staff or notifications (their existing build errors stay); enabling Classes, Sessions or Enrolment.

## 5. Decisions needed
1. **Who can see guardian contact details?** Recommend: only School Admin by default (grantsAll). The platform can tick `guardians.view` for principal or bursar roles later.
2. **Can the last guardian be unlinked from a student?** Recommend: yes (the school may not know the parent yet; the "guardian required" rule can become a setting later).
3. **Guardian email change when they already have a login?** Recommend: refuse with a clear code until the email-change flow in the User module exists.

## 6. Implementation order
1. Permissions and registry; errors and policy; strict DTOs.
2. Repository fixes (remove the log line, add search and one-query links, keep method names).
3. Create (transaction), update, link, unlink use cases with audit.
4. Invite and bulk invite through Auth.
5. Get, list, me/children.
6. Controller, routes, container; switch on the module.
7. Tests, build check, notes and platform document update.
