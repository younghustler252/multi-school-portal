# Grades contract review (web ↔ backend)

Status: review only, no implementation. Source of truth: `docs/backend/modules/grades.md` and the grades module source on `refactor/api` (read 2026-11-21). Route matching and shape verification are kept separate, as in `CONTRACT_AUDIT.md`. Nothing here was run against a live API.

## 1. Verdict

The web grades feature is built on a contract that no longer exists. **Every grades call in the web misses**; this is a rebuild of the feature's service, types and screens, not a path correction.

| Web call | Backend |
|---|---|
| `GET /grades` (params `classSubjectId`, `isPublished`) | exists, but the filters are `studentId, classId, subjectId, termId` (strict query: `classSubjectId`/`isPublished` are rejected). Response shape is different (section 3) |
| `POST /grades`, `PUT /grades/:id` | gone. Scores are saved per sheet |
| `POST /grades/bulk` `{termId, classSubjectId, grades[{studentId, caScore, examScore}]}` | replaced by `PUT /grades/sheets/:classSubjectId/scores` |
| `POST /grades/publish` `{termId, classSubjectId?}` | replaced by the workflow `submit → approve → publish → lock`, one POST each, per sheet |
| `GET/PUT /grades/config` | replaced by `/grades/scales` and `/grades/schemes` (per level) |
| `GET /grades/me` (student) | gone. Student uses `GET /grades` (OWN scope, published only) |
| `GET /grades/my-children` (guardian) | gone. Guardian uses `GET /grades?studentId=` (OWN scope, linked children, published only) |

## 2. Endpoints (backend, all under `/api/v1/grades`, school realm)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/scales`, `/schemes` | `grades.view` | all four levels (`default, primary, jss, ss`), fallback resolved |
| PUT | `/scales/:level` | `grades.config` + plan feature `grading.custom` | body `{bands[1..15]}` |
| PUT | `/schemes/:level` | `grades.config` | body `{components[1..8]}`, maxima total exactly 100 |
| DELETE | `/scales/:level`, `/schemes/:level` | `grades.config` | not for `default` (409 `GRADES_DEFAULT_REQUIRED`) |
| GET | `/sheets` | `grades.view` | paged; `termId` (default current), `classId`, `subjectId`, `status` |
| GET | `/sheets/:classSubjectId` | `grades.view` | one sheet with students, parts, summary, history and `can` flags |
| PUT | `/sheets/:classSubjectId/scores` | `grades.enter` | `{entries[1..200]{studentId, scores[1..8]{position, score?, absent?}}}` |
| POST | `/sheets/:classSubjectId/submit` | `grades.submit` | |
| POST | `.../approve` | `grades.approve` | |
| POST | `.../publish` | `grades.publish` | recomputes with the current scale, ranks, publishes |
| POST | `.../lock` | `grades.publish` | |
| POST | `.../reopen` | `grades.approve` (while submitted/approved) or `grades.reopen` (published/locked) | body `{reason}` 5–500 chars |
| GET | `/` | `grades.view` | results list: `studentId, classId, subjectId, termId`, limit ≤ 100 |

The route id is the **`ClassSubject.id`**, not the result-sheet id. The web already carries `classSubjectId`, which is good. All DTOs are strict.

## 3. Response shapes the web must adopt

- **Sheet list item:** `{classSubjectId, status, class{id,name}, subject{id,name,code}, teacher{id,name}, term{id,name,session{id,name}|null}, students, complete}`. `status` of a sheet that has no row yet is `draft`.
- **Sheet detail:** `{id|null, classSubjectId, status, class, subject, teacher, term, parts[{position,name,kind,maxScore}], students[{student{id,name,admissionNumber}, scores[{position,score|null,absent}], total, grade, remark, position}], summary{students,complete,incomplete}, history{submittedAt,approvedAt,publishedAt,lockedAt,reopenedAt,reopenReason}, can{enter,submit,approve,publish,lock,reopen}}`. The `can` flags already combine permission, scope and status. **The UI should show buttons from `can`, not from role names or permission keys.**
- **Save scores result:** `{status, saved, unchanged, skipped[{student|null, studentId, reason: duplicate_entry|not_on_class_list|invalid_score, message?}], summary{students,complete}}`. Partial saves are normal: valid entries are saved and the rest are reported.
- **Result row (`GET /grades`):** `{id, student{id,name,admissionNumber}, class, subject, term, status, scores[{name,kind,maxScore,score|null,absent}], total, grade, remark, position, outOf}`. Note `outOf` (was `totalStudents`), no `caScore/examScore`, no `isPublished`, no ids for class-subject.
- **Scales:** `{levels[{level, usesDefault, scale{id,name,bands[{minScore,upTo|null,grade,remark,isPass}]}|null}]}`, highest band first. Writes send `bands[{minScore,grade,remark,isPass}]`; the `maxScore` the web edits today does not exist (a band runs to the next band's start).
- **Schemes:** same envelope with `components[{name,kind,maxScore}]` (to be checked in the DTO mapper when built).
- **Transition result:** `{classSubjectId, status}`.

## 4. Workflow (state machine)

`draft → submitted → approved → published → locked`; `reopen` returns any non-draft sheet to draft. Scores are editable **only in draft**. Approval is mandatory (constant `REQUIRE_APPROVAL = true`, backend open item 2). Reopen hides the grades from families at once and clears the earlier submit/approve/publish/lock metadata.

Error codes the UI must handle: `GRADES_SHEET_NOT_EDITABLE` (409, `{status}`), `GRADES_ILLEGAL_TRANSITION` (409, `{action,status}`), `GRADES_SHEET_INCOMPLETE` (409, `{missing[{student,missing[]}] (first 50), total}`), `GRADES_SHEET_EMPTY` (409), `GRADES_SCALE_INVALID` / `GRADES_SCHEME_INVALID` (400, `{problems[]}`), `GRADES_DEFAULT_REQUIRED` (409), `GRADES_LEVEL_INVALID`, plus 403 "only the subject you teach" and 404 "Mark sheet".

## 5. Who may do what (scope)

- **Enter/submit:** `ALL`, or ASSIGNED = the **teacher of that subject**. A class teacher can view all subjects of the class they lead but cannot enter or submit unless they also teach that subject.
- **View:** ALL; BRANCH (staff, by the class's branch; view only); ASSIGNED staff = subjects they teach plus all subjects of classes they lead; OWN student/guardian = published results only. Sheets list has no OWN scope, so students and guardians get **nothing** from `/grades/sheets`.
- **Approve / publish / lock:** ALL staff. **Reopen:** `grades.approve` while in review, `grades.reopen` (sensitive) afterwards.
- Students and guardians may read scales/schemes (REM-005 decision) but nothing else.

## 6. Workflow issues found in the current web

1. **Roster source is wrong.** The teaching/school pages build the roster from `useEnrolments` + `useStudents({limit: 500})`. The sheet detail already returns the class-list students (active and completed enrolments, withdrawn/transferred excluded). The 500-student fetch and the enrolment join should go.
2. **One "Save" plus "Publish" button cannot express the workflow.** Submit, approve, publish, lock and reopen are separate steps with separate permissions, and the current page assumes the teacher publishes. Under the new model the teacher stops at submit; an approver and a publisher act later.
3. **Completeness is a hard gate.** Submit and publish need every student on the list to have every part entered or marked absent. A missing part is *not* zero. The UI needs a per-student "missing parts" display and a way to mark absence per part; the current number inputs have neither.
4. **Total, grade, rank are server-computed and only exist when complete.** The web must not compute them. Grades appear in the sheet only after the draft scores are saved (the server writes them on save); the exact timing of the draft grade (before publish the grade may be provisional) should be confirmed (question B3).
5. **Score input must follow `parts`,** not a fixed CA/exam pair. Schemes have 1–8 components, so the table columns come from `sheet.parts`.
6. **Partial saves.** `skipped[]` must be shown per student (`invalid_score` carries a message).
7. **Subject-teacher visibility.** The teaching page relies on `useMyClasses`. Class teachers see every subject of their class read-only; the page must not offer entry on subjects they do not teach (use `can.enter`).
8. **Grading config tab edits `maxScore` bands.** The new model has start scores only, per level, with `isPass`, and a plan feature gate for custom scales (`grading.custom`; the entitlements field in backend PR #49, not yet merged, is how the UI would know in advance. Until then the 403/feature error must be handled after the fact).
9. **Principal/insights page** (`insights/grades`) looks up a single grade per student with `classSubjectId`; it should read the sheet detail (view-only).
10. **Student/guardian views** use removed endpoints; use `GET /grades` (+`studentId` for guardians) and show only `status in published|locked` rows, which the server already filters.
11. **Report cards** consume only published/locked sheets. After a reopen the card goes stale (staff only); the report-card screens should link the missing-subject list to the sheet.

## 7. Contract gaps / questions for the backend

- **B1.** No list of **terms a sheet can be opened for** other than `termId` (default current). Confirm the web should pass the `termId` from the sessions module.
- **B2.** `GET /grades/sheets` has **no OWN scope**; a teacher's "my sheets" list works only via ASSIGNED. Confirm that is intended (students never need it).
- **B3.** Are `total/grade/position` stored on save for draft sheets (so the draft shows a provisional grade), or only after publish? The sheet detail returns `grade` per student; the docs say publish recomputes with the *current* scale, which suggests draft values may be provisional.
- **B4.** `REQUIRE_APPROVAL` is a constant. If it becomes a school setting the UI needs it in the sheet (`can.publish` after submit). Until then the web assumes approval is mandatory.
- **B5.** The schemes response envelope is read from the use case only; confirm the final shape (`components[]` key names) before the settings screen is built.
- **B6.** The result row does not carry the `classSubjectId` (it returns class and subject objects). Fine for views; flag if a "go to sheet" link is wanted.
- **B7.** Rank/`outOf` are per subject and exist only after publish; confirm they are null before that.

## 8. Proposed implementation slices (after review of this doc)

1. **Contracts + service + hooks** for scales/schemes, sheets, scores, transitions, results; pure helpers (`sheetActions(can)`, missing-parts summary, skip-reason labels, error messages); tests. No screens.
2. **Teacher sheet screen** (`teaching/grades`): pick class → subject → sheet, grid driven by `parts`, save/submit, show `can`-based actions and incomplete list.
3. **Approver/publisher screen** (`school/grades`): sheet list with status filter, approve/publish/lock/reopen (reason).
4. **Student, guardian and principal views** on `GET /grades`.
5. **Grading setup tab** on scales/schemes (needs B5).

Slices 1–4 are buildable on the confirmed contract; B3 and B5 are the only items that affect shape.
