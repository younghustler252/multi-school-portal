import { Request, Response, NextFunction } from "express";
import { SendSchoolNotificationUseCase } from "../usecases/send-school-notification.usecase";
import { SendPlatformNotificationUseCase } from "../usecases/send-platform-notification.usecase";
import { GetNotificationsUseCase } from "../usecases/get-notifications.usecase";
import { GetMyNotificationsUseCase } from "../usecases/get-my-notification.usecase";
import { MarkNotificationReadUseCase } from "../usecases/mark-notification-read.usecase";
import { MarkAllNotificationsReadUseCase } from "../usecases/mark-all-notification-read.usecase";
import {
	sendCreated,
	sendPaginated,
	sendSuccess,
} from "../../../shared/utils/api-response";

interface Dependencies {
	sendSchoolNotificationUseCase: SendSchoolNotificationUseCase;
	sendPlatformNotificationUseCase: SendPlatformNotificationUseCase;
	getNotificationsUseCase: GetNotificationsUseCase;
	getMyNotificationsUseCase: GetMyNotificationsUseCase;
	markNotificationReadUseCase: MarkNotificationReadUseCase;
	markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase;
}

export class NotificationController {
	private readonly sendSchoolNotificationUseCase: SendSchoolNotificationUseCase;
	private readonly sendPlatformNotificationUseCase: SendPlatformNotificationUseCase;
	private readonly getNotificationsUseCase: GetNotificationsUseCase;
	private readonly getMyNotificationsUseCase: GetMyNotificationsUseCase;
	private readonly markNotificationReadUseCase: MarkNotificationReadUseCase;
	private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase;

	constructor({
		sendSchoolNotificationUseCase,
		sendPlatformNotificationUseCase,
		getNotificationsUseCase,
		getMyNotificationsUseCase,
		markNotificationReadUseCase,
		markAllNotificationsReadUseCase,
	}: Dependencies) {
		this.sendSchoolNotificationUseCase = sendSchoolNotificationUseCase;
		this.sendPlatformNotificationUseCase = sendPlatformNotificationUseCase;
		this.getNotificationsUseCase = getNotificationsUseCase;
		this.getMyNotificationsUseCase = getMyNotificationsUseCase;
		this.markNotificationReadUseCase = markNotificationReadUseCase;
		this.markAllNotificationsReadUseCase = markAllNotificationsReadUseCase;
	}

	// ── Send school notification ──────────────────────────────────────────
	sendSchoolNotification = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.sendSchoolNotificationUseCase.execute(
				req.body,
				req.user!.id,
			);
			sendCreated(res, result, "Notification sent successfully");
		} catch (err) {
			next(err);
		}
	};

	// ── Get school notifications ──────────────────────────────────────────
	getSchoolNotifications = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.getNotificationsUseCase.getSchoolNotifications(
				req.query as any,
			);
			sendPaginated(res, result.data, result.meta);
		} catch (err) {
			next(err);
		}
	};

	// ── Send platform notification (super admin) ──────────────────────────
	sendPlatformNotification = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.sendPlatformNotificationUseCase.execute(
				req.body,
				req.user!.id,
			);
			sendCreated(res, result, "Platform notification sent successfully");
		} catch (err) {
			next(err);
		}
	};

	// ── Get platform notifications (super admin) ──────────────────────────
	getPlatformNotifications = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.getNotificationsUseCase.getPlatformNotifications(
				req.query as any,
			);
			sendPaginated(res, result.data, result.meta);
		} catch (err) {
			next(err);
		}
	};

	// ── Get my notifications ──────────────────────────────────────────────
	getMyNotifications = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.getMyNotificationsUseCase.execute(
				req.user!.id,
				req.user!.role,
				req.user!.schoolId ?? null,
				{
					page: req.query.page ? Number(req.query.page) : undefined,
					limit: req.query.limit ? Number(req.query.limit) : undefined,
				},
			);

			sendPaginated(res, result.data, result.meta);
		} catch (err) {
			next(err);
		}
	};

	// ── Mark one notification as read ─────────────────────────────────────
	markNotificationRead = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const { recipientId } = req.params;
			const kind = req.query.kind === "platform" ? "platform" : "school";

			await this.markNotificationReadUseCase.execute(
				recipientId as string,
				kind,
			);

			sendSuccess(res, null, "Notification marked as read");
		} catch (err) {
			next(err);
		}
	};

	// ── Mark all notifications as read ────────────────────────────────────
	markAllNotificationsRead = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const result = await this.markAllNotificationsReadUseCase.execute(
				req.user!.id,
				req.user!.role,
			);

			sendSuccess(res, result, "All notifications marked as read");
		} catch (err) {
			next(err);
		}
	};
}