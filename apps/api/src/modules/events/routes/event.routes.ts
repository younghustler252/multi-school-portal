import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { container } from "../../../container";
import { EventController } from "../controllers/event.controller";
import { EventTypeController } from "../controllers/event-type.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { uploadLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";
import { AppError } from "../../../shared/errors/domain.errors";
import { requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import { CreateEventTypeDto, UpdateEventTypeDto } from "../dtos/event-type.dto";
import { CreateEventDto, UpdateEventDto, RescheduleEventDto, CancelEventDto, NotifyEventDto } from "../dtos/event.dto";

/*
| EVENT ROUTES (school realm, mounted at /events)
|   GET    /        any signed-in staff, student or parent: the events they may see
|   GET    /types        any signed-in staff, student or parent: the ACTIVE event types. ?includeInactive=true needs events.types.manage
|   POST   /types        events.types.manage   create a custom type { name, color?, icon? }
|   PATCH  /types/:typeId  events.types.manage  rename, recolour, change icon, deactivate/reactivate (a system type: colour and icon only)
|   DELETE /types/:typeId  events.types.manage  delete a custom type no event uses (a used one is deactivated instead)
|   GET    /:id     same (an event you may not see is a 404)
|   POST   /        events.manage   create an event (always a draft)
|   PATCH  /:id     events.manage   change a draft or a published event (a cancelled one is frozen)
|   DELETE /:id     events.manage   delete a DRAFT (a published event is cancelled instead, so its history is kept)
|   GET    /:id/audience     events.manage   how many people the event reaches (nothing is sent)
|   POST   /:id/publish      events.publish  draft -> published (tells the audience when the school has event notices on)
|   POST   /:id/reschedule   events.publish  move a published event (new revision; tells the audience)
|   POST   /:id/cancel       events.publish  published -> cancelled, optional { reason } (tells the audience)
|   POST   /:id/cover        events.manage   upload the cover image (multipart field "cover": JPEG, PNG or WebP, up to 2 MB)
|   DELETE /:id/cover        events.manage   remove the cover image
|   POST   /:id/notify       events.publish  { kind: published|rescheduled|cancelled } send that notice now (once per person and channel)
*/
const router = Router();
const coverUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
// Turns multer failures (too large, wrong field) into the standard error shape
const coverFile = (req: Request, res: Response, next: NextFunction) => coverUpload.single("cover")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
        return next(new AppError((err as { code?: string }).code === "LIMIT_FILE_SIZE" ? "File is too large" : "Upload failed", 400, true, "EVENT_INVALID_IMAGE"));
    }
    next(err);
});
const ctrl = () => container.resolve<EventController>("eventController");
const typesCtrl = () => container.resolve<EventTypeController>("eventTypeController");
const viewer = [authenticate, requireTenant, requirePersona("STAFF", "STUDENT", "GUARDIAN")] as const;
const manage = [authenticate, requireTenant, requirePermission("events.manage")] as const;
const manageTypes = [authenticate, requireTenant, requirePermission("events.types.manage")] as const;
const publish = [authenticate, requireTenant, requirePermission("events.publish")] as const;

// Declared BEFORE "/:id" so "types" is never read as an event id
router.get("/types", ...viewer, (q, s, n) => typesCtrl().list(q, s, n));
router.post("/types", ...manageTypes, validate(CreateEventTypeDto), (q, s, n) => typesCtrl().create(q, s, n));
router.patch("/types/:typeId", ...manageTypes, validate(UpdateEventTypeDto), (q, s, n) => typesCtrl().update(q, s, n));
router.delete("/types/:typeId", ...manageTypes, (q, s, n) => typesCtrl().remove(q, s, n));

router.get("/", ...viewer, (q, s, n) => ctrl().list(q, s, n));
router.get("/:id/audience", ...manage, (q, s, n) => ctrl().audience(q, s, n));
router.get("/:id", ...viewer, (q, s, n) => ctrl().get(q, s, n));
router.post("/", ...manage, validate(CreateEventDto), (q, s, n) => ctrl().create(q, s, n));
router.patch("/:id", ...manage, validate(UpdateEventDto), (q, s, n) => ctrl().update(q, s, n));
router.delete("/:id", ...manage, (q, s, n) => ctrl().remove(q, s, n));
router.post("/:id/cover", ...manage, uploadLimiter, coverFile, reestablishTenantContext, (q, s, n) => ctrl().uploadCover(q, s, n));
router.delete("/:id/cover", ...manage, (q, s, n) => ctrl().removeCover(q, s, n));
router.post("/:id/publish", ...publish, (q, s, n) => ctrl().publish(q, s, n));
router.post("/:id/reschedule", ...publish, validate(RescheduleEventDto), (q, s, n) => ctrl().reschedule(q, s, n));
router.post("/:id/cancel", ...publish, validate(CancelEventDto), (q, s, n) => ctrl().cancel(q, s, n));
router.post("/:id/notify", ...publish, validate(NotifyEventDto), (q, s, n) => ctrl().notify(q, s, n));

export default router;
