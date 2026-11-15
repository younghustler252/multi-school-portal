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

## Open product decision: a teacher leaves
Deactivating a staff member returns `warnings.activeAssignments` (a count) but does **not** release their classes or subjects: `Class.classTeacherId` and `ClassSubject.staffId` keep pointing at an inactive person, and mark sheets stay with them. Nothing owns the hand-over. Options: (1) block until reassigned, (2) warn only (today), (3) auto-release, with the default teacher or class teacher taking over. Classes should own the operation. Not implemented until chosen.

## When a Teaching domain would be justified
Not now: a Teacher table would be 1:1 with Staff with no fields of its own, and a new persona would ripple through access, memberships, sessions and every permission that declares `personas: ["STAFF"]`.
Revisit when two or more of these arrive: timetabling, workload limits, substitute cover, heads of department, teacher registration and subject specialisations, several class teachers per class. Even then the shape is a 1:1 *teaching profile* extension on Staff owned by a Teaching module, not a second identity.
