import { Prisma } from "../../../generated/tenant";
import { Prisma as publicPrisma } from "../../../generated/public";
import {
	PlatformNotificationEntity,
	PlatformNotificationRecipientEntity,
	SchoolNotificationEntity,
} from "../domain/notification.entity";
import {
	PaginatedResult,
	PaginateParams,
} from "../../../infrastructure/repository/base.repository";

export interface INotificationRepository {
	// ── Platform notifications ────────────────────────────────────────────
	createPlatformNotification(
		data: publicPrisma.PlatformNotificationUncheckedCreateInput,
	): Promise<PlatformNotificationEntity>;

	updatePlatformNotification(
		id: string,
		data: Record<string, any>,
	): Promise<PlatformNotificationEntity>;

	paginatePlatformNotifications(
		params: PaginateParams,
	): Promise<PaginatedResult<PlatformNotificationEntity>>;

	findPlatformNotificationById(
		id: string,
	): Promise<PlatformNotificationEntity | null>;

	// ── School notifications ──────────────────────────────────────────────
	createSchoolNotification(
		data: Prisma.SchoolNotificationUncheckedCreateInput,
	): Promise<SchoolNotificationEntity>;

	paginateSchoolNotifications(
		params: PaginateParams,
	): Promise<PaginatedResult<SchoolNotificationEntity>>;

	// ── School notification recipients ────────────────────────────────────
	createRecipient(
		data: Prisma.SchoolNotificationRecipientUncheckedCreateInput,
	): Promise<void>;

	findMySchoolNotifications(
		recipientFilter: {
			studentId?: string;
			guardianId?: string;
			staffId?: string;
		},
		params: PaginateParams,
	): Promise<PaginatedResult<any>>;

	markSchoolRecipientRead(
		recipientId: string,
	): Promise<void>;

	markAllSchoolRecipientsRead(
		recipientFilter: {
			studentId?: string;
			guardianId?: string;
			staffId?: string;
		},
	): Promise<number>;

	// ── Platform notification recipients ──────────────────────────────────
	createPlatformRecipient(
		data: publicPrisma.PlatformNotificationRecipientUncheckedCreateInput,
	): Promise<PlatformNotificationRecipientEntity>;

	findMyPlatformNotifications(
		schoolId: string,
		params: PaginateParams,
	): Promise<PaginatedResult<any>>;

	markPlatformRecipientSent(
		id: string,
	): Promise<void>;

	markPlatformRecipientFailed(
		id: string,
		reason: string,
	): Promise<void>;

	markPlatformRecipientRead(
		recipientId: string,
	): Promise<void>;
}