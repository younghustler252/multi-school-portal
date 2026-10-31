import { Router } from "express";
import { container } from "../../../container";
import { GradesSheetsController } from "../controllers/grades-sheets.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requireAnyPermission } from "../../../infrastructure/middleware/rbac.middleware";
import { SaveScoresDto, ReopenDto } from "../dtos/grades-sheets.dto";

/*
| GRADES MARK SHEET ROUTES (school realm, mounted at /grades with the setup routes). Fixed paths come before "/:id".
| grades.view     = list sheets, open a sheet, the results list (scope decides whose)
| grades.enter    = save scores            grades.submit  = submit a finished draft
| grades.approve  = approve (or send back) grades.publish = publish and lock
| grades.reopen   = reopen a published or locked sheet. Everything is scoped again inside the use cases.
*/
const router = Router();
const ctrl = () => container.resolve<GradesSheetsController>("gradesSheetsController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;

router.get("/", ...guard("grades.view"), (q, s, n) => ctrl().grades(q, s, n));
router.get("/sheets", ...guard("grades.view"), (q, s, n) => ctrl().sheets(q, s, n));
router.get("/sheets/:classSubjectId", ...guard("grades.view"), (q, s, n) => ctrl().sheet(q, s, n));
router.put("/sheets/:classSubjectId/scores", ...guard("grades.enter"), validate(SaveScoresDto), (q, s, n) => ctrl().saveScores(q, s, n));
router.post("/sheets/:classSubjectId/submit",  ...guard("grades.submit"),  (q, s, n) => ctrl().move("submit", "Mark sheet submitted")(q, s, n));
router.post("/sheets/:classSubjectId/approve", ...guard("grades.approve"), (q, s, n) => ctrl().move("approve", "Mark sheet approved")(q, s, n));
router.post("/sheets/:classSubjectId/publish", ...guard("grades.publish"), (q, s, n) => ctrl().move("publish", "Mark sheet published")(q, s, n));
router.post("/sheets/:classSubjectId/lock",    ...guard("grades.publish"), (q, s, n) => ctrl().move("lock", "Mark sheet locked")(q, s, n));
// reopen: which permission is needed depends on how far the sheet got (approve while in review, reopen once out), checked inside
router.post("/sheets/:classSubjectId/reopen", authenticate, requireTenant, requireAnyPermission("grades.approve", "grades.reopen"), validate(ReopenDto), (q, s, n) => ctrl().move("reopen", "Mark sheet reopened")(q, s, n));

export default router;
