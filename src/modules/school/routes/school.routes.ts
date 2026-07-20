import { Router }                from "express";
import multer                    from "multer";
import { container }             from "../../../container";
import { SchoolController }      from "../controllers/school.controller";
import { validate }              from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }          from "../../../infrastructure/middleware/auth.middleware";
import {
    requireRoles,
    requireSchoolAdmin,
    requireSuperAdmin,
}                                from "../../../infrastructure/middleware/rbac.middleware";
import {
    UpdateSchoolDto,
    UploadDocumentDto,
    RejectSchoolDto,
    SuspendSchoolDto,
    RejectDocumentDto,
    SetupPaymentDto,
    CreateSchoolDto,
}                                from "../dtos/school.dto";

/*
|--------------------------------------------------------------------------
| SCHOOL ROUTES
|
| School Admin routes  → /api/v1/school/me/*
| Super Admin routes   → /api/v1/school/* (no /me prefix)
|--------------------------------------------------------------------------
*/

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),  // store in memory — we upload to Supabase
    limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ── Lazy resolve controller ───────────────────────────────────────────────
const ctrl = () => container.resolve<SchoolController>("schoolController");

// ========================================
// SCHOOL ADMIN ROUTES
// ========================================

// Get own school profile
router.get(
    "/me",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().getMySchool(req, res, next),
);

// Update own school profile
router.put(
    "/me",
    authenticate,
    requireSchoolAdmin,
    validate(UpdateSchoolDto),
    (req, res, next) => ctrl().updateMySchool(req, res, next),
);

// Upload school logo
router.post(
    "/me/logo",
    authenticate,
    requireSchoolAdmin,
    upload.single("logo"),
    (req, res, next) => ctrl().uploadLogo(req, res, next),
);

// Upload verification document
router.post(
    "/me/documents",
    authenticate,
    requireSchoolAdmin,
    upload.single("document"),
    validate(UploadDocumentDto),
    (req, res, next) => ctrl().uploadDocument(req, res, next),
);

// Get own documents
router.get(
    "/me/documents",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().getMyDocuments(req, res, next),
);

// Setup Paystack payment
router.post(
    "/me/payment-setup",
    authenticate,
    requireSchoolAdmin,
    validate(SetupPaymentDto),
    (req, res, next) => ctrl().setupPayment(req, res, next),
);
router.get(
    "/me/dashboard",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().getDashboard(req, res, next),
);
// ========================================
// SUPER ADMIN ROUTES
// ========================================

// Get all schools
router.get(
    "/",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().getAllSchools(req, res, next),
);

// Create school directly
router.post(
    "/",
    authenticate,
    requireSuperAdmin,
    validate(CreateSchoolDto),
    (req, res, next) => ctrl().createSchool(req, res, next),
);

// Get school by ID
router.get(
    "/:id",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().getSchoolById(req, res, next),
);

// Verify school
router.put(
    "/:id/verify",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().verifySchool(req, res, next),
);

// Reject school verification
router.put(
    "/:id/reject",
    authenticate,
    requireSuperAdmin,
    validate(RejectSchoolDto),
    (req, res, next) => ctrl().rejectSchool(req, res, next),
);

// Suspend school
router.put(
    "/:id/suspend",
    authenticate,
    requireSuperAdmin,
    validate(SuspendSchoolDto),
    (req, res, next) => ctrl().suspendSchool(req, res, next),
);

// Activate school
router.put(
    "/:id/activate",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().activateSchool(req, res, next),
);

// Approve document
router.put(
    "/documents/:documentId/approve",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().approveDocument(req, res, next),
);

// Reject document
router.put(
    "/documents/:documentId/reject",
    authenticate,
    requireSuperAdmin,
    validate(RejectDocumentDto),
    (req, res, next) => ctrl().rejectDocument(req, res, next),
);

export default router;