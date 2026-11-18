# Teacher handover (when a teacher leaves)

Status: **slice 1 built: the read-only model and the existing-data report (PR #33).** Escalation defaults approved. Reassignment, rollover and reminders are not built yet, and will not be added to PR #33.
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

## Escalation: agreed defaults and the exact clock (NOT built; specification for the notification slice)
Goal: administrators are told immediately, reminded sensibly, and the principal is brought in if it drags on, **without ever blocking the school**.

### Agreed defaults (approved by the product owner)
| Track | Admin reminder | Escalate to principal | Then |
|---|---|---|---|
| **Class teacher** handover (a class they led) | day **2** | day **5** | weekly until resolved |
| **Subject assignments and defaults** | day **3** | day **7** | weekly until resolved |
Notified **immediately** on deactivation (day 0), always, whatever the term state. "Day N" below is defined by the clock, not by the calendar.

### The clock, precisely
1. **Tracks.** Each departed teacher has up to two tracks: the *class-lead track* (while any class they led is outstanding) and the *subject track* (while any subject assignment or default is outstanding). Each track has its own clock and its own stages. A message to one recipient on one day may combine the tracks that are due into one digest.
2. **Start.** A track starts at the **instant of deactivation** (`Staff.deactivatedAt`, to be added; never the administrator-entered `exitDate`, which can be backdated). If a track later empties (everything resolved) and new outstanding items appear again, that is a **new track with a new start**. A reactivation followed by a new deactivation is also a new start.
3. **Days are school-local.** Dates are in the school's own timezone (default `Africa/Lagos`). `D0` is the school-local date of the start.
4. **An in-session date** is any school-local calendar date that falls inside a term, from its `startDate` through its `endDate`, **inclusive**, in **any** term of the school. All calendar days inside a term count: weekends and public holidays included. A date in more than one term counts once. Dates outside every term (holidays, between terms) are **paused**: they never count.
5. **Elapsed days `E(today)`** = the number of in-session dates `d` with `D0 < d <= today`. So `E` is 0 on the day of deactivation, and the first in-session day after it is `E = 1`. `E` never decreases, and it does not advance on paused dates.
6. **Stages are thresholds on `E`:**
   - admin reminder when `E >= reminderDay` (class lead 2, subject 3);
   - principal escalation when `E >= escalationDay` (class lead 5, subject 7); the administrators are reminded again at the same time;
   - weekly thereafter: when `E >= escalationDay + 7k` for `k = 1, 2, 3, ...`, to administrators **and** the principal, until the track is empty.
7. **Evaluation and catch-up.** A job evaluates each school once per school-local day. A stage is *due* when its threshold is reached and it has not been sent. If the job missed days, the next run sends each due stage **once** (never duplicates, never a burst of missed weekly reminders: only the latest weekly one).
8. **Idempotence.** Each stage is recorded against (teacher, track, start). It is sent at most once per start. A track that empties stops everything; nothing is sent for it again.
9. **Between terms.** The clock stays paused (rule 4). Instead, if the track is still non-empty, administrators get a **pre-term nudge 14 days and 7 days before the next term's `startDate`** (the first term whose `startDate` is after today). A nudge is only sent if its date is today or later when the track exists (no back-dating). Nudges are not stages, do not change `E`, and are not sent if no upcoming term exists. When the term opens, counting resumes from where it paused.
10. **Who.** Administrators = holders of `classes.manage`. Principal = the school's principal; in a multi-branch school, the branch principal of the class's branch first, then the principal. Branch-scoped administrators only hear about their own branches' classes.
11. **Resolution** is the read model going empty (reassignment, or reactivation). Nothing blocks term rollover or report-card publishing at any stage.

### Worked examples (computed by applying rules 4 to 6 literally; they become the acceptance tests of the notification slice)
Calendar used: **Term 1: Mon 14 Sep 2026 to Fri 11 Dec 2026. Term 2: Mon 11 Jan 2027 to Fri 2 Apr 2027.** Everything else is a pause.

**Example A: a class teacher and a subject teacher both deactivated on Fri 4 Dec 2026, during term.** `D0 = Fri 4 Dec`.
| Date | `E` | Class-lead track (2 / 5 / weekly) | Subject track (3 / 7 / weekly) |
|---|---|---|---|
| Fri 4 Dec 2026 | 0 | notified immediately | notified immediately |
| Sun 6 Dec | 2 | **admin reminder** (`E >= 2`) | |
| Mon 7 Dec | 3 | | **admin reminder** (`E >= 3`) |
| Wed 9 Dec | 5 | **escalate to principal** (`E >= 5`) | |
| Fri 11 Dec | 7 | | **escalate to principal** (`E >= 7`) |
| Sat 12 Dec to Sun 10 Jan | stays 7 | paused | paused |
| Mon 28 Dec and Mon 4 Jan | 7 | pre-term nudge to admins (14 and 7 days before 11 Jan), only if still non-empty | same |
| Mon 11 Jan 2027 | 8 | clock resumes | clock resumes |
| Fri 15 Jan | 12 | **weekly** (`E >= 5 + 7`) | |
| Sun 17 Jan | 14 | | **weekly** (`E >= 7 + 7`) |
| Fri 22 Jan | 19 | **weekly** (`E >= 5 + 14`) | |
| Sun 24 Jan | 21 | | **weekly** (`E >= 7 + 14`) |
(Weekly means every 7 **in-session** days, which is every calendar week while a term runs.)

**Example B: deactivated during the holiday, Sun 20 Dec 2026 (outside every term).** Notified immediately. `E = 0` until Term 2. Pre-term nudges Mon 28 Dec and Mon 4 Jan if non-empty. `E(Mon 11 Jan) = 1`. Class-lead track: reminder Tue 12 Jan (`E=2`), escalation Fri 15 Jan (`E=5`). Subject track: reminder Wed 13 Jan (`E=3`), escalation Sun 17 Jan (`E=7`).

**Example C: resolved quickly.** Deactivated Fri 4 Dec and everything reassigned by Sat 5 Dec (`E = 1`): the day-0 notice only. No reminder, no escalation, nothing between terms.

**Example D: partly resolved.** Class reassigned on Tue 8 Dec (`E = 4`, class-lead track ends, so its escalation on Wed 9 Dec never happens); subject assignments remain: the subject track keeps its original clock (reminder Mon 7 Dec already sent, escalation Fri 11 Dec, weekly from Sun 17 Jan). Stages already sent are never sent again.

**Example E: the evaluation job was down Wed 13 Jan to Mon 18 Jan.** On the next run (Tue 19 Jan, `E = 16` for both tracks): the class-lead weekly stage `E >= 12` is due and has not been sent, so it is sent **once**; the `E >= 19` stage is not yet due. The subject track's weekly stage `E >= 14` is due and is sent once; `E >= 21` is not yet due. Nothing is duplicated and no missed intermediate stage is replayed.

### Implementation notes
- Needs `Staff.deactivatedAt` (nullable timestamp, backfilled from the `staff.deactivated` audit entry; exit date is not used).
- The outstanding set stays **derived**. Only the per-(teacher, track, start) stage record is stored (a small state table in the notification slice).
- Per-school override of the defaults is a later setting; the values above are the platform defaults.

## Later steps and one schema finding
2. Reassignment (single and "give all of X's to Y", with preview), reusing the existing assign use cases and eligibility rule, audited, no schema change. Source stays `manual`; the departed teacher is recorded in the audit details.
3. Term rollover must not carry a departed teacher forward (today it copies last term's `staffId` and seeds from `defaultTeacherId`).
   **Schema finding:** `ClassSubject.staffId` is **required**, so rollover cannot create an "unassigned" row. Options: (a) make `staffId` nullable (touches many queries), (b) rollover skips the row for a departed teacher and the handover list derives "taught last term by someone who left, nobody this term" (no schema change). Recommend (b); decide at that step.
4. Handover list and dashboard count for administrators, deactivation notification, reminders and escalation, `Staff.deactivatedAt`.
