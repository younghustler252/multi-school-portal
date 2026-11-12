import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { eventTypeErrors } from "../domain/event-type.errors";
import { ListEventTypesQuery } from "../dtos/event-type.dto";
import { ListEventTypesUseCase, CreateEventTypeUseCase, UpdateEventTypeUseCase, DeleteEventTypeUseCase } from "../usecases/event-types.usecases";

interface Dependencies {
    listEventTypesUseCase: ListEventTypesUseCase; createEventTypeUseCase: CreateEventTypeUseCase;
    updateEventTypeUseCase: UpdateEventTypeUseCase; deleteEventTypeUseCase: DeleteEventTypeUseCase;
}

/* EVENT TYPE CONTROLLER (school realm, /events/types). The school is the host's school; the acting person comes ONLY from the verified session. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request) => { if (!req.auth) throw eventTypeErrors.notFound(); return { userId: req.auth.userId }; };

export class EventTypeController {
    constructor(private readonly d: Dependencies) {}

    list   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listEventTypesUseCase.execute(ListEventTypesQuery.parse(req.query), req.access), "Event types retrieved successfully"); } catch (e) { next(e); } };
    create = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createEventTypeUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Event type created"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateEventTypeUseCase.execute(schoolIdOf(req), String(req.params.typeId), req.body, actorOf(req)), "Event type updated"); } catch (e) { next(e); } };
    remove = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteEventTypeUseCase.execute(schoolIdOf(req), String(req.params.typeId), actorOf(req)), "Event type deleted"); } catch (e) { next(e); } };
}
