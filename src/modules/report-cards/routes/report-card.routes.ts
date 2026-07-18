import { Router }                  from "express";
import { container }               from "../../../container";
import { ReportCardController }    from "../controllers/report-card.controller";
import { validate }                from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }            from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                                  from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }           from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requireFeature }          from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    GenerateReportCardDto,
    BulkGenerateReportCardDto,
    UpdateReportCardDto,
    ListReportCardsDto,
}                                  from "../dtos/report-card.dto";

const router = Router();
const ctrl   = () => container.resolve<ReportCardController>("reportCardController");

// ── List report cards ─────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListReportCardsDto, "query"),
    (req, res, next) => ctrl().getReportCards(req, res, next),
);

// ── Get single report card ────────────────────────────────────────────────
router.get(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getReportCard(req, res, next),
);

// ── Generate single report card ───────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(GenerateReportCardDto),
    (req, res, next) => ctrl().generateReportCard(req, res, next),
);

// ── Bulk generate report cards ────────────────────────────────────────────
router.post(
    "/bulk",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(BulkGenerateReportCardDto),
    (req, res, next) => ctrl().bulkGenerateReportCards(req, res, next),
);

// ── Update report card remarks ────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateReportCardDto),
    (req, res, next) => ctrl().updateReportCard(req, res, next),
);

// ── Publish report cards ──────────────────────────────────────────────────
router.post(
    "/publish",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().publishReportCards(req, res, next),
);

// ── Send report card notification (requires Basic plan+) ──────────────────
router.post(
    "/:id/send",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("reportCardPdf"),
    (req, res, next) => ctrl().sendReportCard(req, res, next),
);

export default router;