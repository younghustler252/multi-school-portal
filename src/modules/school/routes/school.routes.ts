import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { container } from "../../../container";
import { SchoolController } from "../controllers/school.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { uploadLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { loadAccess, requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireVerifiedSchool } from "../../../infrastructure/middleware/require-verified-school.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context.middleware";
import { AppError } from "../../../shared/errors/domain.errors";
import { UpdateSchoolDto, UploadDocumentDto, SetupPaymentDto } from "../dtos/school.dto";

/*
| SCHOOL ROUTES: the school's own data, on the school's host (mounted at /school), plus one public endpoint.
| Platform actions live in school.platform.routes.ts under /platform/schools.
| Upload routes: authenticate -> access -> limiter -> multer -> reestablishTenantContext -> validate.
*/

const router = Router();
const ctrl   = () => container.resolve<SchoolController>("schoolController");

const memory = (maxBytes: number) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes } });
const logoUpload     = memory(2 * 1024 * 1024);
const documentUpload = memory(5 * 1024 * 1024);

// Turns multer failures (too large, wrong field) into the standard error shape
const single = (m: multer.Multer, field: string, code: "INVALID_IMAGE" | "INVALID_FILE") =>
    (req: Request, res: Response, next: NextFunction) =>
        m.single(field)(req, res, (err: unknown) => {
            if (!err) return next();
            if (err instanceof multer.MulterError) {
                return next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "File is too large" : "Upload failed", 400, true, code));
            }
            next(err);
        });

// ── Public (no login): the login screen asks for this by subdomain ────────
router.get("/public/:subdomain", (q, s, n) => ctrl().getPublicSchoolInfo(q, s, n));

// ── The current school ────────────────────────────────────────────────────
router.get("/",  authenticate, requireTenant, requirePermission("school.view"),   (q, s, n) => ctrl().getMySchool(q, s, n));
router.put("/",  authenticate, requireTenant, requirePermission("school.update"), validate(UpdateSchoolDto), (q, s, n) => ctrl().updateMySchool(q, s, n));

router.post("/logo",
    authenticate, requireTenant, requirePermission("school.update"), uploadLimiter,
    single(logoUpload, "logo", "INVALID_IMAGE"), reestablishTenantContext,
    (q, s, n) => ctrl().uploadLogo(q, s, n),
);

// ── Verification documents ────────────────────────────────────────────────
router.get("/documents", authenticate, requireTenant, requirePermission("school.documents.manage"), (q, s, n) => ctrl().getMyDocuments(q, s, n));
router.post("/documents",
    authenticate, requireTenant, requirePermission("school.documents.manage"), uploadLimiter,
    single(documentUpload, "document", "INVALID_FILE"), reestablishTenantContext, validate(UploadDocumentDto),
    (q, s, n) => ctrl().uploadDocument(q, s, n),
);

// ── Payment account (locked until the school is verified) ─────────────────
router.post("/payment-setup",
    authenticate, requireTenant, requirePermission("school.payments.manage"), requireVerifiedSchool, validate(SetupPaymentDto),
    (q, s, n) => ctrl().setupPayment(q, s, n),
);

// ── Dashboard and setup ───────────────────────────────────────────────────
router.get("/dashboard",       authenticate, requireTenant, requirePermission("school.dashboard.view"), (q, s, n) => ctrl().getDashboard(q, s, n));
router.get("/setup-checklist", authenticate, requireTenant, requirePermission("school.update"),         (q, s, n) => ctrl().getSetupChecklist(q, s, n));

export default router;
