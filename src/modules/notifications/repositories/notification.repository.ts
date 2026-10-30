import { Prisma } from "../../../generated/tenant";
import { Prisma as publicPrisma } from "../../../generated/public";
import {
	PlatformNotificationEntity,
	PlatformNotificationRecipientEntity,
	RecipientKind,
	SchoolNotificationEntity,
	SchoolNotificationRecipientEntity,
} from "../domain/notification.entity";
import {
	PaginatedResult,
	PaginateParams,
} from "../../../infrastructure/repository/base.repository";

/** Who a school message row belongs to: a student, a guardian or a staff member (the id is that person's own record id). */
export interface RecipientOwner {
	recipientType:     RecipientKind;
	recipientEntityId: string;
}

export interface DeliverableRef { id: string; channel: "EMAIL" | "SMS" }

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

	findSchoolNotificationById(id: string): Promise<SchoolNotificationEntity | null>;

	// ── School notification recipients ────────────────────────────────────
	/** Inserts the rows that are new; a row that breaks a unique rule (same idempotency key, same person on the same message and channel) is skipped. Returns how many were inserted. */
	createSchoolRecipientsBatch(
		rows: Prisma.SchoolNotificationRecipientCreateManyInput[],
	): Promise<number>;

	/** Which of these idempotency keys already have a row. */
	findExistingIdempotencyKeys(keys: string[]): Promise<Set<string>>;

	findSchoolRecipientById(id: string): Promise<SchoolNotificationRecipientEntity | null>;

	/** Email and SMS rows of one message that are waiting to be handed to the queue. */
	findUnqueuedDeliverables(notificationId: string): Promise<DeliverableRef[]>;

	/** Email and SMS rows still waiting (PENDING) or queued but not moving (QUEUED) since before `olderThan`. */
	findStaleDeliverables(olderThan: Date, limit: number): Promise<DeliverableRef[]>;

	markSchoolRecipientsQueued(ids: string[]): Promise<void>;
	markSchoolRecipientSent(id: string, providerMsgId?: string): Promise<void>;
	markSchoolRecipientFailed(id: string, reason: string): Promise<void>;

	/** The person's in-app messages (email and SMS copies are not shown in the inbox). */
	findMySchoolNotifications(
		owner: RecipientOwner,
		params: PaginateParams,
	): Promise<PaginatedResult<any>>;

	/** Marks one message read, only if it belongs to this person. Returns false when it is not theirs or does not exist. */
	markSchoolRecipientRead(recipientId: string, owner: RecipientOwner): Promise<boolean>;

	markAllSchoolRecipientsRead(owner: RecipientOwner): Promise<number>;

	// ── Platform notification recipients ──────────────────────────────────
	createPlatformRecipient(
		data: publicPrisma.PlatformNotificationRecipientUncheckedCreateInput,
	): Promise<PlatformNotificationRecipientEntity>;

	findPlatformRecipientById(id: string): Promise<PlatformNotificationRecipientEntity | null>;

	findMyPlatformNotifications(
		schoolId: string,
		params: PaginateParams,
	): Promise<PaginatedResult<any>>;

	markPlatformRecipientSent(id: string, providerMsgId?: string): Promise<void>;
	markPlatformRecipientFailed(id: string, reason: string): Promise<void>;

	/** The contact of the school's admin account (platform messages go to this person). */
	findSchoolAdminContact(schoolId: string): Promise<{ email: string; phone: string | null; firstName: string | null } | null>;

	/** Marks one platform message read, only if it was sent to this school. */
	markPlatformRecipientRead(recipientId: string, schoolId: string): Promise<boolean>;
}
