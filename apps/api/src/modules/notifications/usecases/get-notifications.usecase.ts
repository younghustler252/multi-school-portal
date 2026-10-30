import { INotificationRepository }           from "../repositories/notification.repository";
import { PlatformNotificationMapper }        from "../mappers/notification.mapper";
import { SchoolNotificationMapper }          from "../mappers/notification.mapper";
import { PaginatedResult }                   from "../../../infrastructure/repository/base.repository";
import { ListNotificationsDtoType }          from "../dtos/notification.dto";

interface Dependencies {
    notificationRepository:     INotificationRepository;
    platformNotificationMapper: PlatformNotificationMapper;
    schoolNotificationMapper:   SchoolNotificationMapper;
}

export class GetNotificationsUseCase {
    private readonly notificationRepository:     INotificationRepository;
    private readonly platformNotificationMapper: PlatformNotificationMapper;
    private readonly schoolNotificationMapper:   SchoolNotificationMapper;

    constructor({
        notificationRepository,
        platformNotificationMapper,
        schoolNotificationMapper,
    }: Dependencies) {
        this.notificationRepository     = notificationRepository;
        this.platformNotificationMapper = platformNotificationMapper;
        this.schoolNotificationMapper   = schoolNotificationMapper;
    }

    // ── Platform notifications (super admin) ──────────────────────────────
    async getPlatformNotifications(
        dto: ListNotificationsDtoType,
    ): Promise<PaginatedResult<any>> {
        const where: Record<string, any> = {};
        if (dto.type)  where.type  = dto.type;
        if (dto.state) where.state = dto.state;

        const result = await this.notificationRepository
            .paginatePlatformNotifications({
                page:    Number(dto.page)  || 1,
                limit:   Number(dto.limit) || 20,
                where,
            });

        return {
            data: result.data.map(n =>
                this.platformNotificationMapper.toResponse(n),
            ),
            meta: result.meta,
        };
    }

    // ── School notifications (school admin/staff) ─────────────────────────
    async getSchoolNotifications(
        dto: ListNotificationsDtoType,
    ): Promise<PaginatedResult<any>> {
        const where: Record<string, any> = {};
        if (dto.type) where.type = dto.type;

        const result = await this.notificationRepository
            .paginateSchoolNotifications({
                page:    Number(dto.page)  || 1,
                limit:   Number(dto.limit) || 20,
                where,
            });

        return {
            data: result.data.map(n =>
                this.schoolNotificationMapper.toResponse(n),
            ),
            meta: result.meta,  
        };
    }
}