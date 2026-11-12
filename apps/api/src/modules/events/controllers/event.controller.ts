import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { eventErrors } from "../domain/event.errors";
import { ListEventsQuery } from "../dtos/event.dto";
import { PublishEventUseCase, RescheduleEventUseCase, CancelPublishedEventUseCase, NotifyEventUseCase, PreviewEventAudienceUseCase } from "../usecases/event-lifecycle.usecases";
import { UploadEventCoverUseCase, RemoveEventCoverUseCase } from "../usecases/event-cover.usecases";
import { ListEventsUseCase, GetEventUseCase, CreateEventUseCase, UpdateEventUseCase, DeleteEventUseCase } from "../usecases/events.usecases";

interface Dependencies {
    listEventsUseCase: ListEventsUseCase; getEventUseCase: GetEventUseCase; createEventUseCase: CreateEventUseCase;
    updateEventUseCase: UpdateEventUseCase; deleteEventUseCase: DeleteEventUseCase;
    publishEventUseCase: PublishEventUseCase; rescheduleEventUseCase: RescheduleEventUseCase; cancelPublishedEventUseCase: CancelPublishedEventUseCase;
    notifyEventUseCase: NotifyEventUseCase; previewEventAudienceUseCase: PreviewEventAudienceUseCase;
    uploadEventCoverUseCase: UploadEventCoverUseCase; removeEventCoverUseCase: RemoveEventCoverUseCase;
}

/* EVENT CONTROLLER (school realm, /events). The school is the host's school; the acting person comes ONLY from the verified session. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const param = (req: Request, name: string): string => String(req.params[name]);
const actorOf = (req: Request) => { if (!req.auth) throw eventErrors.notFound(); return { userId: req.auth.userId }; };

export class EventController {
    constructor(private readonly d: Dependencies) {}

    // The validate middleware does not write query values back, so the query is parsed here
    list   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listEventsUseCase.execute(ListEventsQuery.parse(req.query), req.access), "Events retrieved successfully"); } catch (e) { next(e); } };
    get    = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getEventUseCase.execute(param(req, "id"), req.access), "Event retrieved successfully"); } catch (e) { next(e); } };
    create = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createEventUseCase.execute(schoolIdOf(req), req.body, actorOf(req), req.access), "Event saved as a draft"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateEventUseCase.execute(schoolIdOf(req), param(req, "id"), req.body, actorOf(req), req.access), "Event updated successfully"); } catch (e) { next(e); } };
    remove = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteEventUseCase.execute(schoolIdOf(req), param(req, "id"), actorOf(req), req.access), "Draft event deleted successfully"); } catch (e) { next(e); } };

    publish    = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.publishEventUseCase.execute(schoolIdOf(req), param(req, "id"), actorOf(req), req.access), "Event published"); } catch (e) { next(e); } };
    reschedule = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.rescheduleEventUseCase.execute(schoolIdOf(req), param(req, "id"), req.body, actorOf(req), req.access), "Event rescheduled"); } catch (e) { next(e); } };
    cancel     = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.cancelPublishedEventUseCase.execute(schoolIdOf(req), param(req, "id"), req.body ?? {}, actorOf(req), req.access), "Event cancelled"); } catch (e) { next(e); } };
    notify     = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.notifyEventUseCase.execute(schoolIdOf(req), param(req, "id"), req.body.kind, actorOf(req), req.access), "Notice processed"); } catch (e) { next(e); } };
    audience   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.previewEventAudienceUseCase.execute(param(req, "id"), req.access), "Audience preview"); } catch (e) { next(e); } };

    uploadCover = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) throw eventErrors.invalidImage();
            sendSuccess(res, await this.d.uploadEventCoverUseCase.execute(schoolIdOf(req), param(req, "id"), { buffer: req.file.buffer }, actorOf(req).userId, req.access), "Cover image saved");
        } catch (e) { next(e); }
    };
    removeCover = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.removeEventCoverUseCase.execute(schoolIdOf(req), param(req, "id"), actorOf(req).userId, req.access), "Cover image removed"); } catch (e) { next(e); } };
}
