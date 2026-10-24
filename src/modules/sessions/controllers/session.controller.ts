import { Request, Response, NextFunction } from "express";
import { ListSessionsUseCase, GetCurrentAcademicYearUseCase } from "../usecases/session-queries.usecases";
import { CreateSessionUseCase, UpdateSessionUseCase, CreateTermUseCase, UpdateTermUseCase } from "../usecases/session-commands.usecases";
import { SetCurrentSessionUseCase, SetCurrentTermUseCase } from "../usecases/set-current.usecases";
import { ListCalendarEventsUseCase, CreateCalendarEventUseCase, UpdateCalendarEventUseCase, DeleteCalendarEventUseCase } from "../usecases/calendar.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { ListCalendarEventsQuery } from "../dtos/calendar.dto";
import { sessionErrors } from "../domain/session.errors";
import { SessionActor } from "../domain/session.types";

interface Dependencies {
    listSessionsUseCase: ListSessionsUseCase; getCurrentAcademicYearUseCase: GetCurrentAcademicYearUseCase;
    createSessionUseCase: CreateSessionUseCase; updateSessionUseCase: UpdateSessionUseCase;
    createTermUseCase: CreateTermUseCase; updateTermUseCase: UpdateTermUseCase;
    setCurrentSessionUseCase: SetCurrentSessionUseCase; setCurrentTermUseCase: SetCurrentTermUseCase;
    listCalendarEventsUseCase: ListCalendarEventsUseCase; createCalendarEventUseCase: CreateCalendarEventUseCase;
    updateCalendarEventUseCase: UpdateCalendarEventUseCase; deleteCalendarEventUseCase: DeleteCalendarEventUseCase;
}

/*
| SESSION CONTROLLER (school realm, /sessions). The school is the host's school; the acting person comes ONLY
| from the verified session (req.auth), never from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const param = (req: Request, name: string): string => String(req.params[name]);
const actorOf = (req: Request): SessionActor => { if (!req.auth) throw sessionErrors.sessionNotFound(); return { userId: req.auth.userId }; };

export class SessionController {
    constructor(private readonly d: Dependencies) {}

    list    = async (_q: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listSessionsUseCase.execute(), "Sessions retrieved successfully"); } catch (e) { next(e); } };
    current = async (_q: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getCurrentAcademicYearUseCase.execute(), "Current session retrieved successfully"); } catch (e) { next(e); } };

    createSession = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createSessionUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Session created successfully"); } catch (e) { next(e); } };
    updateSession = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateSessionUseCase.execute(schoolIdOf(req), param(req, "id"), req.body, actorOf(req)), "Session updated successfully"); } catch (e) { next(e); } };
    setCurrentSession = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.setCurrentSessionUseCase.execute(schoolIdOf(req), param(req, "id"), actorOf(req)), "Current session updated successfully"); } catch (e) { next(e); } };

    createTerm = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createTermUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Term created successfully"); } catch (e) { next(e); } };
    updateTerm = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateTermUseCase.execute(schoolIdOf(req), param(req, "termId"), req.body, actorOf(req)), "Term updated successfully"); } catch (e) { next(e); } };
    setCurrentTerm = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.setCurrentTermUseCase.execute(schoolIdOf(req), param(req, "termId"), req.body ?? { carryForward: true }, actorOf(req)), "Current term updated successfully"); } catch (e) { next(e); } };

    // The validate middleware does not write query values back, so the calendar query is parsed here
    listEvents = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listCalendarEventsUseCase.execute(ListCalendarEventsQuery.parse(req.query)), "Calendar events retrieved successfully"); } catch (e) { next(e); } };
    createEvent = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createCalendarEventUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Calendar event created successfully"); } catch (e) { next(e); } };
    updateEvent = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateCalendarEventUseCase.execute(schoolIdOf(req), param(req, "eventId"), req.body, actorOf(req)), "Calendar event updated successfully"); } catch (e) { next(e); } };
    deleteEvent = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteCalendarEventUseCase.execute(schoolIdOf(req), param(req, "eventId"), actorOf(req)), "Calendar event deleted successfully"); } catch (e) { next(e); } };
}
