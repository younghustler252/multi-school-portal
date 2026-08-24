import { asClass }                           from "awilix";
import type { AwilixContainer }              from "awilix";
import {
    PlatformNotificationMapper,
    SchoolNotificationMapper,
}                                            from "./mappers/notification.mapper";
import { NotificationRepositoryImpl }        from "./repositories/notification.repository.impl";
import { SendSchoolNotificationUseCase }     from "./usecases/send-school-notification.usecase";
import { SendPlatformNotificationUseCase }   from "./usecases/send-platform-notification.usecase";
import { NotificationService } from "./services/notification.service";
import { GetNotificationsUseCase }           from "./usecases/get-notifications.usecase";
import { NotificationController }            from "./controllers/notification.controller";

export const registerNotifications = (container: AwilixContainer): void => {
    container.register({
        platformNotificationMapper:      asClass(PlatformNotificationMapper).singleton(),
        schoolNotificationMapper:        asClass(SchoolNotificationMapper).singleton(),
        notificationRepository:          asClass(NotificationRepositoryImpl).scoped(),
        sendSchoolNotificationUseCase:   asClass(SendSchoolNotificationUseCase).scoped(),
        sendPlatformNotificationUseCase: asClass(SendPlatformNotificationUseCase).scoped(),
        notificationService: asClass(NotificationService).scoped(),
        getNotificationsUseCase:         asClass(GetNotificationsUseCase).scoped(),
        notificationController:          asClass(NotificationController).scoped(),
    });
};