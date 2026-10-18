import { Router }                      from "express";
import multer                          from "multer";
import { container }                   from "../../../container";
import { SchoolSettingsController }    from "../controllers/school-settings.controller";
import { validate }                    from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }                from "../../../infrastructure/middleware/auth.middleware";
import { requireSchoolAdmin }          from "../../../infrastructure/middleware/rbac.middleware";
import { UpdateSchoolSettingsDto }     from "../dtos/school-settings.dto";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 2 * 1024 * 1024 },
});

const ctrl = () => container.resolve<SchoolSettingsController>(
    "schoolSettingsController",
);

// ── Get settings ──────────────────────────────────────────────────────────
router.get(
    "/",
     authenticate,
    requireTenant,
    (req, res, next) => ctrl().getSettings(req, res, next),
);

// ── Update settings ───────────────────────────────────────────────────────
router.put(
    "/",
    authenticate,
    requireTenant,
    validate(UpdateSchoolSettingsDto),
    (req, res, next) => ctrl().updateSettings(req, res, next),
);
router.post(
    "/stamp",
    authenticate,
    requireTenant,
    upload.single("stamp"),
    reestablishTenantContext,   // ← add this line, same spot, every upload route
    (req, res, next) => ctrl().uploadStamp(req, res, next),
);

// ── Upload principal signature ────────────────────────────────────────────
router.post(
    "/signature",
    authenticate,
    requireTenant,
    upload.single("signature"),
    reestablishTenantContext,    
    (req, res, next) => ctrl().uploadSignature(req, res, next),
);

export default router;
