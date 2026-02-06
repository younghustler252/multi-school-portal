// controllers/notification/notification.controller.ts

import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../utils/AppError";
import { NotificationService } from "../../services/NotificationService";
import { NotificationType } from "../../types/Notification";
import { UserRole } from "../../types/UserRole";
import { sendSuccess } from "../../utils/response";
import { getParamAsString } from "../../utils/params";

export const createNotification = asyncHandler(
	async (req: Request, res: Response) => {
		const tenantId = req.auth?.tenantId;
		const actorRole = req.auth?.role;

		if (!tenantId || !actorRole) {
			throw new AppError("Unauthorized", 401);
		}

		if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actorRole)) {
			throw new AppError("Forbidden", 403);
		}

		const {
			recipientId,
			recipientRole,
			title,
			message,
			type,
			meta
		} = req.body;

		if (!recipientId || !recipientRole || !title || !message) {
			throw new AppError(
				"recipientId, recipientRole, title, and message are required",
				400
			);
		}

		const notification = await NotificationService.sendToUser(
			tenantId,
			recipientId,
			title,
			message,
			type ?? NotificationType.INFO,
			recipientRole,
			meta
		);

		sendSuccess(
			res,
			notification,
			201,
			"Notification created successfully"
		);
	}
);

export const broadcastNotification = asyncHandler(
	async (req: Request, res: Response) => {
		const tenantId = req.auth?.tenantId;
		const actorRole = req.auth?.role;

		if (!tenantId || !actorRole) {
			throw new AppError("Unauthorized", 401);
		}

		if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actorRole)) {
			throw new AppError("Forbidden", 403);
		}

		const { role, title, message, type, meta } = req.body;

		if (!role || !title || !message) {
			throw new AppError("role, title, and message are required", 400);
		}

		const notifications = await NotificationService.broadcastToRole(
			tenantId,
			role,
			title,
			message,
			type ?? NotificationType.ANNOUNCEMENT,
			meta
		);

		sendSuccess(
			res,
			{ count: notifications.length },
			201,
			"Broadcast sent successfully"
		);
	}
);

export const getMyNotifications = asyncHandler(
	async (req: Request, res: Response) => {
		const tenantId = req.auth?.tenantId;
		const userId = req.auth?.userId;
		const role = req.auth?.role;

		if (!tenantId || !userId || !role) {
			throw new AppError("Unauthorized", 401);
		}

		const notifications = await NotificationService.getForUser(
			tenantId,
			userId,
			role
		);

		sendSuccess(res, notifications);
	}
);

export const markAsRead = asyncHandler(
	async (req: Request, res: Response) => {
		const rawId = req.params.id;
		const notificationId = getParamAsString(rawId);

		if (!notificationId) {
			throw new AppError("Notification ID is required", 400);
		}

		const notification = await NotificationService.markAsRead(notificationId);

		if (!notification) {
			throw new AppError("Notification not found", 404);
		}

		sendSuccess(
			res,
			notification,
			200,
			"Notification marked as read"
		);
	}
);
