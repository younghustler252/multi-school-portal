import {
    PlatformNotificationEntity,
    SchoolNotificationEntity,
}                                from "../domain/notification.entity";
import {
    PaginatedResult,
    PaginateParams,
}                                from "../../../infrastructure/repository/base.repository";

export interface INotificationRepository {
    // ── Platform notifications ────────────────────────────────────────────
    createPlatformNotification(
        data: Record<string, any>,
    ):                                               Promise<PlatformNotificationEntity>;
    updatePlatformNotification(
        id:   string,
        data: Record<string, any>,
    ):                                               Promise<PlatformNotificationEntity>;
    paginatePlatformNotifications(
        params: PaginateParams,
    ):                                               Promise<PaginatedResult<PlatformNotificationEntity>>;
    findPlatformNotificationById(
        id: string,
    ):                                               Promise<PlatformNotificationEntity | null>;

    // ── School notifications ──────────────────────────────────────────────
    createSchoolNotification(
        data: Record<string, any>,
    ):                                               Promise<SchoolNotificationEntity>;
    paginateSchoolNotifications(
        params: PaginateParams,
    ):                                               Promise<PaginatedResult<SchoolNotificationEntity>>;
    createRecipient(
        data: Record<string, any>,
    ):                                               Promise<void>;
}