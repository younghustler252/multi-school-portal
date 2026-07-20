import { Request, Response, NextFunction }    from "express";
import { SendSchoolNotificationUseCase }      from "../usecases/send-school-notification.usecase";
import { SendPlatformNotificationUseCase }    from "../usecases/send-platform-notification.usecase";
import { GetNotificationsUseCase }            from "../usecases/get-notifications.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                             from "../../../shared/utils/api-response";

interface Dependencies {
    sendSchoolNotificationUseCase:   SendSchoolNotificationUseCase;
    sendPlatformNotificationUseCase: SendPlatformNotificationUseCase;
    getNotificationsUseCase:         GetNotificationsUseCase;
}

export class NotificationController {
    private readonly sendSchoolNotificationUseCase:   SendSchoolNotificationUseCase;
    private readonly sendPlatformNotificationUseCase: SendPlatformNotificationUseCase;
    private readonly getNotificationsUseCase:         GetNotificationsUseCase;

    constructor({
        sendSchoolNotificationUseCase,
        sendPlatformNotificationUseCase,
        getNotificationsUseCase,
    }: Dependencies) {
        this.sendSchoolNotificationUseCase   = sendSchoolNotificationUseCase;
        this.sendPlatformNotificationUseCase = sendPlatformNotificationUseCase;
        this.getNotificationsUseCase         = getNotificationsUseCase;
    }

    // ── Send school notification ──────────────────────────────────────────
    sendSchoolNotification = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.sendSchoolNotificationUseCase.execute(
                req.body,
                req.user!.id,
            );
            sendCreated(res, result, "Notification sent successfully");
        } catch (err) { next(err); }
    };

    // ── Get school notifications ──────────────────────────────────────────
    getSchoolNotifications = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getNotificationsUseCase
                .getSchoolNotifications(req.query as any);
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Send platform notification (super admin) ──────────────────────────
    sendPlatformNotification = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.sendPlatformNotificationUseCase.execute(
                req.body,
                req.user!.id,
            );
            sendCreated(res, result, "Platform notification sent successfully");
        } catch (err) { next(err); }
    };

    // ── Get platform notifications (super admin) ──────────────────────────
    getPlatformNotifications = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getNotificationsUseCase
                .getPlatformNotifications(req.query as any);
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };
}