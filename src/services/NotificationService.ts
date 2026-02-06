// services/NotificationService.ts
import { Types } from "mongoose";
import { Notification } from "../models/Notification";
import User from "../models/User";
import { NotificationType, NotificationChannels, NotificationMeta } from "../types/Notification";
import { UserRole } from "../types/UserRole";
import { SchoolService } from "./schoolService";
import { AppError } from "../utils/AppError";
import { resolveAllowedChannels } from "../utils/notificationUtils";
import { toObjectId } from "../utils/notificationUtils";

export class NotificationService {

	static async sendToUser(
		tenantId: string | Types.ObjectId,
		recipientId: string | Types.ObjectId,
		title: string,
		message: string,
		type: NotificationType = NotificationType.INFO,
		recipientRole: UserRole = UserRole.STUDENT,
		meta: NotificationMeta = {},
		requestedChannels?: NotificationChannels,
		link?: string
	) {
		const school = await SchoolService.getSchoolByTenantId(tenantId);
		if (!school) {
			throw new AppError("School not found for tenant", 404);
		}

		const channels = resolveAllowedChannels(
			school.subscriptionPlan,
			requestedChannels
		);

		const notification = new Notification({
			tenantId: toObjectId(tenantId),
			recipientId: toObjectId(recipientId),
			recipientRole,
			title,
			message,
			type,
			meta,
			channels,
			link
		});

		await notification.save();
		return notification;
	}



	static async broadcastToRole(
		tenantId: string | Types.ObjectId,
		role: UserRole,
		title: string,
		message: string,
		type: NotificationType = NotificationType.ANNOUNCEMENT,
		meta: NotificationMeta = {},
		requestedChannels?: NotificationChannels,
		link?: string
	) {
		const school = await SchoolService.getSchoolByTenantId(tenantId);
		if (!school) {
			throw new AppError("School not found for tenant", 404);
		}

		const channels = resolveAllowedChannels(
			school.subscriptionPlan,
			requestedChannels
		);

		if (!channels.inApp && !channels.email && !channels.push) {
			return [];
		}

		const users = await User.find({
			tenantId: toObjectId(tenantId),
			role
		})
			.select("_id")
			.lean();

		if (!users.length) return [];

		const notifications = users.map(user => ({
			tenantId: toObjectId(tenantId),
			recipientId: user._id,
			recipientRole: role,
			title,
			message,
			type,
			meta,
			channels,
			link
		}));

		await Notification.insertMany(notifications);
		return notifications;
	}



	static async markAsRead(notificationId: string) {
		return Notification.findByIdAndUpdate(
			notificationId,
			{ isRead: true },
			{ new: true }
		);
	}

	static async getForUser(
		tenantId: string,
		userId: string,
		role: UserRole
	) {
		return Notification
			.find({ tenantId, recipientId: userId, recipientRole: role })
			.sort({ createdAt: -1 })
			.lean();
	}

	static async getUnreadCount(
		tenantId: string,
		userId: string,
		role: UserRole
	) {
		return Notification.countDocuments({
			tenantId,
			recipientId: userId,
			recipientRole: role,
			isRead: false
		});
	}
}
