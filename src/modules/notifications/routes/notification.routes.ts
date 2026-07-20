import { Router }                  from "express";
import { container }               from "../../../container";
import { NotificationController }  from "../controllers/notification.controller";
import { validate }                from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }            from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireSuperAdmin,
}                                  from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }           from "../../../infrastructure/middleware/tenant-resolver.middleware";
import {
    SendSchoolNotificationDto,
    SendPlatformNotificationDto,
    ListNotificationsDto,
}                                  from "../dtos/notification.dto";

const router = Router();
const ctrl   = () => container.resolve<NotificationController>(
    "notificationController",
);

// ── School notifications ──────────────────────────────────────────────────
router.get(
    "/school",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(ListNotificationsDto, "query"),
    (req, res, next) => ctrl().getSchoolNotifications(req, res, next),
);

router.post(
    "/school",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(SendSchoolNotificationDto),
    (req, res, next) => ctrl().sendSchoolNotification(req, res, next),
);

// ── Platform notifications (super admin only) ─────────────────────────────
router.get(
    "/platform",
    authenticate,
    requireSuperAdmin,
    validate(ListNotificationsDto, "query"),
    (req, res, next) => ctrl().getPlatformNotifications(req, res, next),
);

router.post(
    "/platform",
    authenticate,
    requireSuperAdmin,
    validate(SendPlatformNotificationDto),
    (req, res, next) => ctrl().sendPlatformNotification(req, res, next),
);

export default router;