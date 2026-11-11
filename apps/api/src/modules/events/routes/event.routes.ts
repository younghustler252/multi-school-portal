import { Router } from "express";
import { container } from "../../../container";
import { EventController } from "../controllers/event.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import { CreateEventDto, UpdateEventDto } from "../dtos/event.dto";

/*
| EVENT ROUTES (school realm, mounted at /events)
|   GET    /        any signed-in staff, student or parent: the events they may see
|   GET    /:id     same (an event you may not see is a 404)
|   POST   /        events.manage   create an event (always a draft)
|   PATCH  /:id     events.manage   change a draft or a published event (a cancelled one is frozen)
|   DELETE /:id     events.manage   delete a DRAFT (a published event is cancelled instead, so its history is kept)
| Publishing, cancelling, notices and the audience preview are added in the lifecycle step.
*/
const router = Router();
const ctrl = () => container.resolve<EventController>("eventController");
const viewer = [authenticate, requireTenant, requirePersona("STAFF", "STUDENT", "GUARDIAN")] as const;
const manage = [authenticate, requireTenant, requirePermission("events.manage")] as const;

router.get("/", ...viewer, (q, s, n) => ctrl().list(q, s, n));
router.get("/:id", ...viewer, (q, s, n) => ctrl().get(q, s, n));
router.post("/", ...manage, validate(CreateEventDto), (q, s, n) => ctrl().create(q, s, n));
router.patch("/:id", ...manage, validate(UpdateEventDto), (q, s, n) => ctrl().update(q, s, n));
router.delete("/:id", ...manage, (q, s, n) => ctrl().remove(q, s, n));

export default router;
