import { Router } from "express";
import { container } from "../../../container";
import { SessionController } from "../controllers/session.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { CreateSessionDto, UpdateSessionDto, CreateTermDto, UpdateTermDto, SetCurrentTermDto } from "../dtos/session.dto";
import { CreateCalendarEventDto, UpdateCalendarEventDto } from "../dtos/calendar.dto";

/*
| SESSION ROUTES (school realm, mounted at /sessions on the school's host).
| sessions.view   = see sessions, terms, the current term and the calendar (on every default role)
| sessions.manage = create and edit sessions, terms and calendar events, choose the current session / term
| Fixed paths ("/current", "/terms...", "/calendar/events...") come before "/:id".
*/
const router = Router();
const ctrl   = () => container.resolve<SessionController>("sessionController");
const view   = [authenticate, requireTenant, requirePermission("sessions.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("sessions.manage")] as const;

router.get("/current", ...view, (q, s, n) => ctrl().current(q, s, n));
router.get("/calendar/events", ...view, (q, s, n) => ctrl().listEvents(q, s, n));
router.post("/calendar/events", ...manage, validate(CreateCalendarEventDto), (q, s, n) => ctrl().createEvent(q, s, n));
router.put("/calendar/events/:eventId", ...manage, validate(UpdateCalendarEventDto), (q, s, n) => ctrl().updateEvent(q, s, n));
router.delete("/calendar/events/:eventId", ...manage, (q, s, n) => ctrl().deleteEvent(q, s, n));

router.post("/terms", ...manage, validate(CreateTermDto), (q, s, n) => ctrl().createTerm(q, s, n));
router.put("/terms/:termId", ...manage, validate(UpdateTermDto), (q, s, n) => ctrl().updateTerm(q, s, n));
router.put("/terms/:termId/set-current", ...manage, validate(SetCurrentTermDto), (q, s, n) => ctrl().setCurrentTerm(q, s, n));

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, validate(CreateSessionDto), (q, s, n) => ctrl().createSession(q, s, n));
router.put("/:id", ...manage, validate(UpdateSessionDto), (q, s, n) => ctrl().updateSession(q, s, n));
router.put("/:id/set-current", ...manage, (q, s, n) => ctrl().setCurrentSession(q, s, n));

export default router;
