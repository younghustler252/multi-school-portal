# Go-live checklist: branches, attendance, notifications

Run these in order on a copy of production data first (a staging database), then on production. Each step says what "good" looks like.
Commands run from `apps/api`.

## 1. Bring the code in
1. Make sure your branch has everything: the class and student branch migrations (`class_branch`, `student_branch`), the student transfer, the announcement audiences, and the new automations. `git log` and the files in `apps/api/prisma/tenant-migrations` show what is there.
2. `npm run prisma:generate` (public and tenant). The generated client is committed in this repo, so commit the regenerated files too. **Good:** no errors, and `git status` shows the generated files changed.
3. `npm run typecheck`. **Good:** no errors at all. (Before step 2 you will see errors about `branchId` and `studentBranchTransfer`: that is the old generated client, not a bug.)

## 2. Database changes (do a backup first: `npm run db:backup`)
1. `npm run migrate:apply-to-existing-schools:dry-run`. It lists what would run for every school. Read the list. **Good:** each school shows the new migrations (`class_branch`, `student_branch`, and the attendance one if it has not run yet).
2. `npm run migrate:apply-to-existing-schools`. **Good:** every school reports success.
   - If a school stops with "has classes but no main branch" (or students), that school has no main branch. Create or restore its main branch, then run the command again for that school.
3. Spot check one school in SQL: no class and no student has an empty `branchId`; `select count(*) from "Student" where "branchId" is null` is 0.

## 3. Permissions and roles
1. `npm run sync:registries` (new keys: `students.transfer`, the BRANCH scopes for classes, guardians and notifications, the new automations).
2. `npm run sync:school-roles:dry-run`, read it, then `npm run sync:school-roles`.
3. New keys are **not** handed to existing editable roles. Grant by hand where you want them:
   - `attendance.mark` to the teacher roles (without it, existing teachers cannot take attendance).
   - `students.transfer` only to roles that should be allowed to move students between branches (school admin already has it).
   - `notifications.send` at BRANCH scope to branch principals who should message their own branch.
   - `classes.view` / `classes.manage` at BRANCH, and `grades.view` at BRANCH, for branch principals in existing schools.

## 4. Tests
1. `npm test`. **Good:** 0 failures. The database tests are skipped unless `TEST_DATABASE_URL` is set.
2. Set `TEST_DATABASE_URL` (the database name must contain "test") and run `npm test` again. **Good:** the database tests now run and pass. Send me any failure.

## 5. Start the app and try it for real (use a test school)
1. Start the API and the worker (`npm run dev` and `npm run dev:worker`, or the production start commands). **Good:** both start; Redis is reachable.
2. Branches: create a second branch. Create a class in it. Create a student in it (give `branchId`).
3. The branch rules (each should be refused with the code shown):
   - Enrol that student in a class of the first branch: `STUDENT_BRANCH_MISMATCH`.
   - Set a class order from a class in one branch into a class in the other: `PROGRESSION_BRANCH_MISMATCH`.
   - Run promotion with such a class order: `PROMOTION_BRANCH_MISMATCH`, and nothing is saved.
4. Transfer: `POST /students/:id/transfer` with `toBranchId`, the new `classId` (if the student has a class this term) and a `reason`. **Good:** the student appears in the new branch, the old attendance and grades stay under the old class, and a transfer record exists.
5. Branch principal: log in as one. **Good:** lists of classes, students, enrolments, attendance and grades show only their branch.
6. Attendance: as a teacher, take a register; look at it again with `?date=` for a past day; correct a mark inside 48 hours.
7. Announcements: send one to "all parents" with a `branchIds` filter. **Good:** only that branch's parents get it. A branch principal asking for another branch gets `AUDIENCE_OUT_OF_SCOPE`.

## 6. Real message delivery (needs live keys)
1. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `TERMII_API_KEY`, `TERMII_SENDER_ID`.
2. In the platform console, activate the plan features `notifications.email` and `notifications.sms` for the plans that should have them, and `automation.rules.max` if you want to limit automations.
3. In a test school switch on the school preferences `automation.enabled`, `notifications.email_enabled` and (if wanted) `notifications.sms_enabled`.
4. Send one announcement to yourself by email and by SMS. **Good:** both arrive; the message shows as SENT in the sent list.
5. For each automation you want, open it, use **dry run**, read the sample messages, then switch it on. Automations (all off by default except the old fee reminder): fee reminder, overdue notice, payment received, new invoice issued, absence notice, low attendance warning, register reminder for teachers, student moved to another branch.
6. Check the queue board (bull-board) shows no stuck jobs after a few minutes.

## 7. After go-live
- Watch the audit log and the automation run log for the first few days.
- Tell the finance developer: when a student is transferred, their old invoices and payments keep the branch they were created under.
