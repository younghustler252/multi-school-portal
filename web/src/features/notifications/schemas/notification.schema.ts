import { z } from "zod";

export const sendNotificationSchema = z.object({
	title: z.string().min(1, "Title is required").max(100),
	message: z.string().min(1, "Message is required"),
	type: z.enum([
		"fee_invoice", "fee_reminder", "fee_receipt", "report_card_ready",
		"attendance_alert", "event", "holiday", "broadcast", "custom",
	]),
	targetType: z.enum([
		"STUDENT", "GUARDIAN", "STAFF", "ALL_PARENTS", "ALL_STUDENTS", "ALL_STAFF", "EVERYONE",
	]),
	channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1, "Select at least one channel"),
});

export type SendNotificationFormValues = z.infer<typeof sendNotificationSchema>;