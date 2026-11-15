# Teacher handover (when a teacher leaves)

Status: **step 1 of 4 built: the read-only model and the existing-data report.** Reassignment, rollover and reminders are not built yet.
Relationship to other work: independent of PR #22 (the Classes/Staff ownership refactor). It uses nothing from it.

## Agreed product rules
1. Deactivation and access revocation are **immediate**. Nothing is blocked while waiting for a replacement.
2. The class and subject assignment records are **kept** (nothing is cleared or moved at deactivation).
3. **Classes owns** the outstanding handover state and, later, the reassignment operation.
4. Outstanding handovers stay **visible to the responsible administrators** until reassigned.
5. Reassign **only to eligible teachers** (active staff, `category = teaching`: the existing Classes teacher rule).
6. **History is preserved**: marks, mark-sheet submit/approve/publish records, score audit trails, past-term assignments.
7. **No automatic release** to default teachers or anyone else.
8. **No hard gates.** Term rollover and report-card publishing continue even when a handover is incomplete. Enforcement is visibility, reminders and escalation to the principal.

## What counts as outstanding (derived from live data, nothing stored)
| Counts | Why |
|---|---|
| A class they **lead** (`Class.classTeacherId`) | Always, whatever their mark sheets look like |
| A **subject assignment** in the current or a future term whose sheet is **not finished** (no sheet yet, draft, submitted, approved) | Unfinished work |
| A subject whose **default teacher** they are | Otherwise it keeps proposing someone who left |
| *Not outstanding:* a subject assignment whose sheet is **published or locked** | Finished. Listed as "completed" (ownership stays visible) but needs no action |
| *Not outstanding:* **past-term** assignments | History: counted, never listed or touched |

Because it is derived, it clears by itself when an assignment is reassigned or the person is reactivated. Branch-scoped administrators see only the classes of their branches; subject defaults belong to no branch and appear only for all-branch viewers.

Code: `classes/services/handover.read-model.ts` (`loadOutstandingHandover`, `assembleHandover`). Tests: `tests/classes/handover-read-model.test.ts`.

## Step 1: the existing-data report (read-only)
`npm run report:orphaned-assignments [-- --json report.json]`
Reads every school inside a `READ ONLY` transaction and lists, per school and per person who left: classes led, outstanding subject assignments (with term and sheet state), finished sheets (no action), defaults to update, and a count of past-term rows. Run it before the feature is switched on so the first administrator view holds no surprises.

## Proposed escalation (for review; not built)
Goal: administrators are told immediately, nagged sensibly, and the principal is brought in if it drags on, without ever blocking the school.
**Clock:** starts at deactivation. There is no `Staff.deactivatedAt` today (`exitDate` is administrator-entered and can be backdated), so the notification step should add a nullable `deactivatedAt` (backfilled from the `staff.deactivated` audit entry).
**Who:** administrators = holders of `classes.manage`. Principal = the school's principal; for a multi-branch school, the branch principal of the class's branch first, then the principal.

| When (calendar days after deactivation) | Subject assignments / defaults | A class they led |
|---|---|---|
| Immediately | Notify administrators; the item appears on the dashboard | same |
| Reminder to administrators | day 3 | day 2 |
| **Escalate to the principal** (administrators reminded too) | day 7 | day 5 |
| Then | weekly, to administrators and principal, until cleared | same |
Why the class lead is faster: attendance, discipline and the report-card remark all hang on the class teacher.
**Term-aware:** the day counter only advances while a term is in session. Between terms nothing escalates. Instead, if anything is still outstanding, administrators get a nudge **14 days and 7 days before the next term starts**, and the clock resumes when the term opens.
**Stops** the moment nothing is outstanding. **Idempotent:** each person and stage is sent once. **Configurable later** per school (defaults above).

## Later steps and one schema finding
2. Reassignment (single and "give all of X's to Y", with preview), reusing the existing assign use cases and eligibility rule, audited, no schema change. Source stays `manual`; the departed teacher is recorded in the audit details.
3. Term rollover must not carry a departed teacher forward (today it copies last term's `staffId` and seeds from `defaultTeacherId`).
   **Schema finding:** `ClassSubject.staffId` is **required**, so rollover cannot create an "unassigned" row. Options: (a) make `staffId` nullable (touches many queries), (b) rollover skips the row for a departed teacher and the handover list derives "taught last term by someone who left, nobody this term" (no schema change). Recommend (b); decide at that step.
4. Handover list and dashboard count for administrators, deactivation notification, reminders and escalation, `Staff.deactivatedAt`.
