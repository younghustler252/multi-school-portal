# Teaching ownership: Staff vs Classes

**Staff is the employee record. Classes owns what a teacher leads and teaches.** There is no Teacher table and no Teaching module (see "When a Teaching domain would be justified").

## Who owns what
| Concern | Owner | Where |
|---|---|---|
| Who works at the school: identity, HR details, status and exit, branch membership, portal access | Staff | `Staff`, `StaffBranch`, staff-portal |
| Is this person eligible to teach (`category = teaching`, active) | Staff stores it; **Classes enforces the rule** | `Staff.category`; `classes/services/teacher-rule.ts` |
| Class teacher (who LEADS a class) | Classes | `Class.classTeacherId` |
| Subject teacher (who TEACHES a subject in a class, per term) | Classes | `ClassSubject.staffId` (+ `assignedVia`) |
| A subject's default teacher | Classes | `Subject.defaultTeacherId` |
| All changes to the three above | Classes | `classes/usecases/school-admin/*` |
| Reading "what does this person lead / teach" | Classes (published read-only) | `teaching-assignments.reader.ts`, `teaching-access.ts` |

## The one definition of "leads" and "teaches"
`classes/services/teaching-access.ts`. Modules choose which pieces their rows need; nobody re-writes the rule:
- **LEADS** a class: `Class.classTeacherId`, any term.
- **TEACHES** a class: a `ClassSubject` row for them in the current term.
- Attendance / enrolment rows: led in any term, taught in the current term only. Students: on the list this term of a class led or taught. Grades: subjects they teach or any subject of a class they lead (viewing); entering is the subject teacher only. Report cards: the class teacher only.
These differences are intended and pinned by `tests/foundation/teaching-scope.characterisation.test.ts`.

## Boundaries (enforced by `tests/architecture/teaching-ownership.test.ts`)
A. No module outside Classes writes its own "leads / teaches" filter.
B. Staff never queries class tables or imports the Class repository; it uses the Classes-owned reader.
C. Classes reads Staff only through the Staff repository interface.

## Known, deliberately kept differences
- `attendance.staffCoversClass(staff, class, term)` accepts any term passed in (a subject teacher of a past term can open that term's register), while the ASSIGNED list shows a subject teacher only the current term's rows. Kept as is; decide if it should be one rule.

## Agreed product direction: when a teacher leaves (NOT yet implemented; separate piece of work)
Deactivation and access revocation happen **immediately** and are never blocked or delayed waiting for a replacement. Security and offboarding come first. What changes is that the teaching assignments are no longer treated as a disposable warning:
1. **Preserve** the existing class and subject assignment records. Nothing is cleared or moved at deactivation.
2. **Classes owns** the outstanding handover state and the reassignment operation. Staff only reports that the person left.
3. **Visible to school administrators** until resolved: an unresolved assignment keeps showing as needing a new teacher.
4. **Reassign only to eligible teachers**: active staff with `category = teaching` (the existing Classes teacher rule, not a new one).
5. **Preserve history.** Marks, sheet submit/approve/publish records, score audit trails and past-term assignments are never rewritten.
6. **No automatic release** to subject default teachers or anyone else. A person chooses the replacement.
The current `warnings.activeAssignments` count stays in the deactivation response; it becomes a pointer to the handover, not the whole story.

### Proposed design (to confirm before building)
- **Derive the state, do not store it.** "Outstanding" = an assignment (class teacher of a class, a current-or-future-term subject assignment, a subject default) that points at an inactive person. No new table: it cannot drift, it clears itself on reassignment, and a rehire clears it too. Reassigning reuses the existing assign use cases (audited, `manual` source, with the departed teacher recorded in the audit metadata).
- **Term rollover must not carry a departed teacher forward** (it copies last term's `staffId` and seeds from `defaultTeacherId` today). New rows are created unassigned and appear in the same handover list.
- **Visibility and "mandatory":** an admin handover list grouped by departed teacher, a dashboard count for `classes.manage` holders, a notification to administrators at deactivation, and reminders. Branch-scoped administrators see only their branches' classes.
- **Existing orphans:** schools already hold assignments pointing at inactive staff. Run a read-only report first so the first view is not a surprise.
- **Open choice:** whether any hard gate is added (for example at term rollover or report-card publishing), or visibility plus reminders only.

## When a Teaching domain would be justified
Not now: a Teacher table would be 1:1 with Staff with no fields of its own, and a new persona would ripple through access, memberships, sessions and every permission that declares `personas: ["STAFF"]`.
Revisit when two or more of these arrive: timetabling, workload limits, substitute cover, heads of department, teacher registration and subject specialisations, several class teachers per class. Even then the shape is a 1:1 *teaching profile* extension on Staff owned by a Teaching module, not a second identity.
