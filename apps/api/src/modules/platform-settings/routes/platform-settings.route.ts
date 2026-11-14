import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { container } from "../../../container";

import { PlatformSettingsController } from "../controllers/platform-settings.controller";

import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { uploadLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { AppError } from "../../../shared/errors/domain.errors";

import { UpdatePlatformSettingsDto } from "../dtos/platform-settings.dto";

const router = Router();

const ctrl = () =>
    container.resolve<PlatformSettingsController>(
        "platformSettingsController",
    );

// ── Platform Settings ─────────────────────────────────────────────────────

// Get platform settings
// Public — no authentication or tenant resolution required.
router.get(
    "/",
    (req, res, next) => ctrl().getSettings(req, res, next),
);

// Update platform settings
// Super Admin only.
router.put(
    "/",
    authenticate,
    requirePermission("platform.settings.manage"),
    validate(UpdatePlatformSettingsDto),
    (req, res, next) => ctrl().updateSettings(req, res, next),
);

// Upload the logo (JPEG, PNG or WebP, up to 2 MB). Super Admin only.
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const singleLogo = (req: Request, res: Response, next: NextFunction) =>
    logoUpload.single("logo")(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            return next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "File is too large" : "Upload failed", 400, true, "INVALID_IMAGE"));
        }
        next(err);
    });

router.post(
    "/logo",
    authenticate,
    requirePermission("platform.settings.manage"),
    uploadLimiter,
    singleLogo,
    (req, res, next) => ctrl().uploadLogo(req, res, next),
);

// Clear the logo. Super Admin only.
router.delete(
    "/logo",
    authenticate,
    requirePermission("platform.settings.manage"),
    (req, res, next) => ctrl().removeLogo(req, res, next),
);

export default router;
