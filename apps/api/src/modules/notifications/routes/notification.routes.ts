import { Router } from "express";
import { container } from "../../../container";
import { NotificationController } from "../controllers/notification.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireSuperAdmin, requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { SendSchoolNotificationDto, SendPlatformNotificationDto, ListNotificationsDto } from "../dtos/notification.dto";

/*
| NOTIFICATION ROUTES (mounted at /notifications)
|  School side (inside a school):
|   GET   /school                     notifications.view            messages the school has sent
|   POST  /school                     notifications.send            send an announcement (email/SMS need the plan feature AND the school's preference)
|   GET   /me                         any signed-in student, guardian or staff member: your own in-app messages
|   PATCH /me/read-all                same: mark all of yours read
|   PATCH /me/:recipientId/read       same: mark one of yours read (a message that is not yours is a 404)
|   GET   /platform-inbox             notifications.platform.view   messages the platform sent to the school
|   PATCH /platform-inbox/:recipientId/read   notifications.platform.view
|  Platform side (super admin, outside a school):
|   GET   /platform                   sent platform messages
|   POST  /platform                   send a platform message to schools
| The fixed paths (/me/read-all) come before the ones with an id, so they are never taken for an id.
*/
const router = Router();
const ctrl = () => container.resolve<NotificationController>("notificationController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;
const mine = [authenticate, requireTenant, requirePersona("STAFF", "STUDENT", "GUARDIAN")] as const;

router.get("/school", ...guard("notifications.view"), validate(ListNotificationsDto, "query"), (q, s, n) => ctrl().getSchoolNotifications(q, s, n));
router.post("/school", ...guard("notifications.send"), validate(SendSchoolNotificationDto), (q, s, n) => ctrl().sendSchoolNotification(q, s, n));

router.get("/me", ...mine, validate(ListNotificationsDto, "query"), (q, s, n) => ctrl().getMyNotifications(q, s, n));
router.patch("/me/read-all", ...mine, (q, s, n) => ctrl().markAllNotificationsRead(q, s, n));
router.patch("/me/:recipientId/read", ...mine, (q, s, n) => ctrl().markNotificationRead(q, s, n));

router.get("/platform-inbox", ...guard("notifications.platform.view"), validate(ListNotificationsDto, "query"), (q, s, n) => ctrl().getPlatformInbox(q, s, n));
router.patch("/platform-inbox/:recipientId/read", ...guard("notifications.platform.view"), (q, s, n) => ctrl().markPlatformMessageRead(q, s, n));

router.get("/platform", authenticate, requireSuperAdmin, validate(ListNotificationsDto, "query"), (q, s, n) => ctrl().getPlatformNotifications(q, s, n));
router.post("/platform", authenticate, requireSuperAdmin, validate(SendPlatformNotificationDto), (q, s, n) => ctrl().sendPlatformNotification(q, s, n));

export default router;
