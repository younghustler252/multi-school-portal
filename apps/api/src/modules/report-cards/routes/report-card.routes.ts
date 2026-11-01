import { Router } from "express";
import { container } from "../../../container";
import { ReportCardController } from "../controllers/report-card.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requireAnyPermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";

/*
| REPORT CARD ROUTES (school realm, mounted at /report-cards). Fixed paths come before "/:id".
| report_cards.view      = list, open, overview, PDF (scope decides whose; families see published cards only). This replaces my-children.
| report_cards.generate  = build draft cards, write the teacher's remark      report_cards.principal_remark = the principal's remark
| report_cards.publish   = publish and take back. Everything is scoped again inside the use cases.
| /templates, /template-preview and /:id/preview return JSON { html, template } to show in an iframe (srcdoc); ?template= tries another template (staff only).
| The PDF also needs the plan feature report_cards.pdf.
*/
const router = Router();
const ctrl = () => container.resolve<ReportCardController>("reportCardController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;

router.get("/", ...guard("report_cards.view"), (q, s, n) => ctrl().list(q, s, n));
// the template picker and its sample preview (staff: report cards or school settings)
router.get("/templates", authenticate, requireTenant, requireAnyPermission("report_cards.view", "school_settings.view"), (q, s, n) => ctrl().templates(q, s, n));
router.get("/template-preview", authenticate, requireTenant, requireAnyPermission("report_cards.view", "school_settings.view"), (q, s, n) => ctrl().templatePreview(q, s, n));
router.get("/overview", ...guard("report_cards.view"), (q, s, n) => ctrl().overview(q, s, n));
// a whole class in one PDF (cached); must come before "/:id"
router.get("/class-pdf", ...guard("report_cards.view"), requireFeature("report_cards.pdf"), (q, s, n) => ctrl().classPdf(q, s, n));
router.post("/generate", ...guard("report_cards.generate"), (q, s, n) => ctrl().generate(q, s, n));
router.post("/publish", ...guard("report_cards.publish"), (q, s, n) => ctrl().publish(q, s, n));
router.post("/unpublish", ...guard("report_cards.publish"), (q, s, n) => ctrl().unpublish(q, s, n));
router.get("/:id", ...guard("report_cards.view"), (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/preview", ...guard("report_cards.view"), (q, s, n) => ctrl().preview(q, s, n));
router.get("/:id/pdf", ...guard("report_cards.view"), requireFeature("report_cards.pdf"), (q, s, n) => ctrl().pdf(q, s, n));
router.put("/:id/remarks", authenticate, requireTenant, requireAnyPermission("report_cards.generate", "report_cards.principal_remark"), (q, s, n) => ctrl().remarks(q, s, n));

export default router;
