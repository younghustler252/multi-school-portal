import { Router } from "express";
import { container } from "../../../container";

import { PlatformSettingsController } from "../controllers/platform-settings.controller";

import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireSuperAdmin } from "../../../infrastructure/middleware/rbac.middleware";

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
    requireSuperAdmin,
    validate(UpdatePlatformSettingsDto),
    (req, res, next) => ctrl().updateSettings(req, res, next),
);

export default router;
