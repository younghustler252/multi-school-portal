import { Request, Response, NextFunction } from "express";
import { SendSchoolNotificationUseCase } from "../usecases/send-school-notification.usecase";
import { SendPlatformNotificationUseCase } from "../usecases/send-platform-notification.usecase";
import { GetNotificationsUseCase } from "../usecases/get-notifications.usecase";
import {
	GetMyNotificationsUseCase, MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase,
	GetPlatformInboxUseCase, MarkPlatformMessageReadUseCase, Inbox,
} from "../usecases/my-notifications.usecases";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { sendCreated, sendPaginated, sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies {
	sendSchoolNotificationUseCase: SendSchoolNotificationUseCase;
	sendPlatformNotificationUseCase: SendPlatformNotificationUseCase;
	getNotificationsUseCase: GetNotificationsUseCase;
	getMyNotificationsUseCase: GetMyNotificationsUseCase;
	markNotificationReadUseCase: MarkNotificationReadUseCase;
	markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase;
	getPlatformInboxUseCase: GetPlatformInboxUseCase;
	markPlatformMessageReadUseCase: MarkPlatformMessageReadUseCase;
}

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
/** Who is asking: from the session's access (persona and the id of their own record), never from the request. */
const inboxOf = (req: Request): Inbox => { const a = getAccess(req); return { persona: a.persona, personaEntityId: a.personaEntityId }; };
const num = (v: unknown): number | undefined => (v ? Number(v) : undefined);

export class NotificationController {
	constructor(private readonly d: Dependencies) {}

	sendSchoolNotification = async (req: Request, res: Response, next: NextFunction) => {
		try { sendCreated(res, await this.d.sendSchoolNotificationUseCase.execute(req.body, schoolIdOf(req), userIdOf(req)), "Notification sent successfully"); } catch (e) { next(e); }
	};

	getSchoolNotifications = async (req: Request, res: Response, next: NextFunction) => {
		try { const r = await this.d.getNotificationsUseCase.getSchoolNotifications(req.query as any); sendPaginated(res, r.data, r.meta); } catch (e) { next(e); }
	};

	sendPlatformNotification = async (req: Request, res: Response, next: NextFunction) => {
		try { sendCreated(res, await this.d.sendPlatformNotificationUseCase.execute(req.body, userIdOf(req)), "Platform notification sent successfully"); } catch (e) { next(e); }
	};

	getPlatformNotifications = async (req: Request, res: Response, next: NextFunction) => {
		try { const r = await this.d.getNotificationsUseCase.getPlatformNotifications(req.query as any); sendPaginated(res, r.data, r.meta); } catch (e) { next(e); }
	};

	getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
		try { const r = await this.d.getMyNotificationsUseCase.execute(inboxOf(req), { page: num(req.query.page), limit: num(req.query.limit) }); sendPaginated(res, r.data, r.meta); } catch (e) { next(e); }
	};

	markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
		try { await this.d.markNotificationReadUseCase.execute(inboxOf(req), String(req.params.recipientId)); sendSuccess(res, null, "Notification marked as read"); } catch (e) { next(e); }
	};

	markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
		try { sendSuccess(res, await this.d.markAllNotificationsReadUseCase.execute(inboxOf(req)), "All notifications marked as read"); } catch (e) { next(e); }
	};

	getPlatformInbox = async (req: Request, res: Response, next: NextFunction) => {
		try { const r = await this.d.getPlatformInboxUseCase.execute(schoolIdOf(req), { page: num(req.query.page), limit: num(req.query.limit) }); sendPaginated(res, r.data, r.meta); } catch (e) { next(e); }
	};

	markPlatformMessageRead = async (req: Request, res: Response, next: NextFunction) => {
		try { await this.d.markPlatformMessageReadUseCase.execute(schoolIdOf(req), String(req.params.recipientId)); sendSuccess(res, null, "Message marked as read"); } catch (e) { next(e); }
	};
}
