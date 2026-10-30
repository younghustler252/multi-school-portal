import { asClass, asValue } from "awilix";
import type { AwilixContainer } from "awilix";

import { PlatformNotificationMapper, SchoolNotificationMapper } from "./mappers/notification.mapper";
import { NotificationRepositoryImpl } from "./repositories/notification.repository.impl";
import { SendSchoolNotificationUseCase } from "./usecases/send-school-notification.usecase";
import { SendPlatformNotificationUseCase } from "./usecases/send-platform-notification.usecase";
import { NotificationService } from "./services/notification.service";
import { NotificationDispatchService } from "./services/notification-dispatch.service";
import { ChannelPolicyService } from "./services/channel-policy.service";
import { NotificationDeliveryService } from "./services/notification-delivery.service";
import { GetNotificationsUseCase } from "./usecases/get-notifications.usecase";
import {
	GetMyNotificationsUseCase, MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase,
	GetPlatformInboxUseCase, MarkPlatformMessageReadUseCase,
} from "./usecases/my-notifications.usecases";
import { NotificationController } from "./controllers/notification.controller";

/*
| Requires: the shared mailService, smsService and channelRegistry; the audit module; the foundation (entitlementsService);
| students, guardians, staff and auth (their repositories); school settings (schoolPreferencesService, optional).
| `notificationDispatchService` is the one road every school message takes; the automation engine uses it too.
| The queue is loaded on first use, so starting the API never opens a queue connection just by registering this module.
*/
export const registerNotifications = (container: AwilixContainer): void => {
	container.register({
		platformNotificationMapper: asClass(PlatformNotificationMapper).singleton(),
		schoolNotificationMapper: asClass(SchoolNotificationMapper).singleton(),
		notificationRepository: asClass(NotificationRepositoryImpl).scoped(),

		notificationDeliveryQueue: asValue({
			enqueue: async (jobs: import("../../infrastructure/jobs/queues/notification.queue").NotificationDeliveryJob[]) =>
				(await import("../../infrastructure/jobs/queues/notification.queue")).enqueueDeliveries(jobs),
		}),
		notificationDispatchService: asClass(NotificationDispatchService).scoped(),
		channelPolicyService: asClass(ChannelPolicyService).scoped(),
		notificationDeliveryService: asClass(NotificationDeliveryService).scoped(),

		sendSchoolNotificationUseCase: asClass(SendSchoolNotificationUseCase).scoped(),
		sendPlatformNotificationUseCase: asClass(SendPlatformNotificationUseCase).scoped(),
		notificationService: asClass(NotificationService).scoped(),
		getNotificationsUseCase: asClass(GetNotificationsUseCase).scoped(),
		getMyNotificationsUseCase: asClass(GetMyNotificationsUseCase).scoped(),
		markNotificationReadUseCase: asClass(MarkNotificationReadUseCase).scoped(),
		markAllNotificationsReadUseCase: asClass(MarkAllNotificationsReadUseCase).scoped(),
		getPlatformInboxUseCase: asClass(GetPlatformInboxUseCase).scoped(),
		markPlatformMessageReadUseCase: asClass(MarkPlatformMessageReadUseCase).scoped(),
		notificationController: asClass(NotificationController).scoped(),
	});
};
