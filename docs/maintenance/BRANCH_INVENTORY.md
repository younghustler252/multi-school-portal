# Branch inventory (read-only)

Taken 2026-11-09 from `origin`. **Nothing was deleted, renamed, merged or created as an integration branch.** Every recommendation needs your review and explicit approval first.

## The important finding: `main` and `feat01` share no history with `refactor/modules`

`git merge-base` finds no common ancestor between `refactor/modules` and either `main` or `feat01`. They are unrelated histories.
- `main` is 5 commits, last touched 2026-06-22 ("upgrade folder structure", Prisma/PostgreSQL migration). `refactor/modules` is 249 commits ahead of it in content terms, but git cannot merge or fast-forward them.
- `feat01` (30 commits, last 2026-09-24, "updates and moderation", "refactoring") is the older line of the same project. Its work is presumably in `refactor/modules` in rewritten form, but that is **not provable from git**; it needs a file-level comparison by someone who knows what was intended.

So "main = stable production" cannot be reached from `refactor/modules` by a normal merge. Options (decide before creating any integration branch):
1. **Make `refactor/modules` the new trunk**: after review, move `main` to it (a deliberate force-update of `main`, with the old `main` kept as a tag such as `archive/main-2026-06`). Cleanest, loses nothing if the old head is tagged.
2. `git merge --allow-unrelated-histories` into `main`: keeps the old history in the graph, but produces one huge conflict-prone merge commit.
3. Keep both and never merge: only fine if `main` is truly abandoned.

My recommendation is option 1, with tags for every old head, but only with your approval.

## Branches

| Branch | Last commit | Unique commits vs `refactor/modules` | Relationship | Useful unmerged work | Suggested action (not taken) |
|---|---|---|---|---|---|
| `refactor/modules` | 2026-11-09 | 0 | the integration line (tip `5390a4c`) | - | keep |
| `phase2/m0-boot` | 2026-11-07 | 0 | fully merged (18 behind) | none | safe to delete after approval |
| `phase2/m1-session` | 2026-11-08 | 0 | fully merged (4 behind) | none | safe to delete after approval |
| `phase2/m2-session` | 2026-11-08 | 3 | forked at `a64fd4c`; 3 behind | web M2 deployment work (env-driven hosts, route guard, `deploy/Caddyfile.example`, `deploy/verify-host-forwarding.sh`, `docs/frontend/DEPLOYMENT.md`). Web and docs only; no backend files | **keep; merge when M2 is reviewed** |
| `api-test-suite-refresh` | 2026-11-08 | 15 | forked at `699beb0` (11 behind); the current test line | local one-command smoke run, guarded test-DB reset, Greenfield fixture, Postman suites and docs | keep; rebase onto `refactor/modules`. Expect an add/add conflict on `scripts/seed-test-data.ts` (keep the `refactor/modules` version) |
| `api-test-suite` | 2026-11-05 | 25 (none in `refactor/modules`; not contained in `-refresh`) | earlier fork of the same work, 211 behind | probably superseded by `-refresh`, but its Postman collection differs in content (about 1,750 changed lines), so not provably | keep until someone confirms `-refresh` has everything; then archive |
| `chore/api-postman-suite` | 2026-11-05 | 26 (not contained in `-refresh`) | earliest Postman work, 212 behind; files under `apps/api/postman/` | the first Postman collection and route audit; `-refresh` holds the later layout under `docs/api-testing/` | same as above |
| `feat01` | 2026-09-24 | 30 (unrelated history) | old line | unknown, see above | keep; **tag before any change** |
| `main` | 2026-06-22 | 5 (unrelated history) | old trunk | none newer than `refactor/modules` | tag as `archive/main-2026-06` before any change |

## Reconciling M2 and `refactor/modules`
- `phase2/m1-session` is fully inside `refactor/modules`. `phase2/m2-session` adds 3 web/deploy-only commits on top of that base, so it does not conflict with backend work and does not have to wait for it. Its section 7 (backend items: trust proxy, reserved labels) was done on `refactor/modules` in `5e152f2`/`7aea3de`/`5390a4c`.
- Backend base for new work: **`refactor/modules` at `5390a4c`**, agreed. The feature branch `feat/api/events-calendar` is cut from there.

## Other observations
- `apps/api/src/generated/` (the Prisma client, 42 files) is tracked in git on `refactor/modules`. That is why the "stale generated client" problem keeps coming back after migrations. Worth a decision (ignore it and generate in CI/`postinstall`).
- Branch names already follow your convention except `api-test-suite`, `api-test-suite-refresh`, `chore/api-postman-suite` and `feat01`. Do not rename them until the cleanup is approved, since open work may point at them.

## Proposed cleanup order (needs your approval at each step)
1. Tag the heads of `main`, `feat01`, `api-test-suite`, `chore/api-postman-suite`.
2. Decide the trunk question above.
3. Rebase and land `api-test-suite-refresh`; confirm it supersedes the two older test branches.
4. Land `phase2/m2-session` after the M2 review.
5. Delete only the fully merged `phase2/m0-boot` and `phase2/m1-session`.
