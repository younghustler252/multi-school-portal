import { Router } from "express";
import { container } from "../../../container";
import { GradesSetupController } from "../controllers/grades-setup.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { SaveScaleDto, SaveSchemeDto } from "../dtos/grades-setup.dto";

/*
| GRADES SETUP ROUTES (school realm, mounted at /grades on the school's host).
| grades.view    = read scales and schemes
| grades.config  = change them. Changing a SCALE also needs the plan feature `grading.custom`; assessment schemes do not.
| `:level` is one of: default, primary, jss, ss. A level with no scale or scheme of its own uses the default.
*/
const router = Router();
const ctrl   = () => container.resolve<GradesSetupController>("gradesSetupController");
const view   = [authenticate, requireTenant, requirePermission("grades.view")] as const;
const config = [authenticate, requireTenant, requirePermission("grades.config")] as const;

router.get("/scales", ...view, (q, s, n) => ctrl().scales(q, s, n));
router.put("/scales/:level", ...config, requireFeature("grading.custom"), validate(SaveScaleDto), (q, s, n) => ctrl().saveScale(q, s, n));
router.delete("/scales/:level", ...config, (q, s, n) => ctrl().deleteScale(q, s, n));

router.get("/schemes", ...view, (q, s, n) => ctrl().schemes(q, s, n));
router.put("/schemes/:level", ...config, validate(SaveSchemeDto), (q, s, n) => ctrl().saveScheme(q, s, n));
router.delete("/schemes/:level", ...config, (q, s, n) => ctrl().deleteScheme(q, s, n));

export default router;
