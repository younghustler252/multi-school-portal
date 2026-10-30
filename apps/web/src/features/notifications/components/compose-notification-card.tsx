"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSendNotification } from "../hooks/use-notifications";
import { sendNotificationSchema, SendNotificationFormValues } from "../schemas/notification.schema";
import { NOTIFICATION_TYPE_LABELS, TARGET_TYPE_LABELS, CHANNEL_LABELS } from "../constants/notification-labels";
import { NotificationChannel } from "../types/notification.types";
import { ApiErrorResponse } from "@/types/api-response";

const ALL_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "SMS"];

export function ComposeNotificationCard() {
	const sendNotification = useSendNotification();

	const {
		register, handleSubmit, setValue, watch, reset,
		formState: { errors, isSubmitting },
	} = useForm<SendNotificationFormValues>({
		resolver: zodResolver(sendNotificationSchema),
		defaultValues: { channels: ["IN_APP"] },
	});
	const values = watch();

	function toggleChannel(channel: NotificationChannel) {
		const current = values.channels ?? [];
		const next = current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel];
		setValue("channels", next, { shouldValidate: true });
	}

	async function onSubmit(formValues: SendNotificationFormValues) {
		try {
			await sendNotification.mutateAsync(formValues);
			toast.success("Notification sent");
			reset({ channels: ["IN_APP"] });
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send notification");
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
			<div className="font-medium">Compose new notification</div>

			<div className="space-y-1.5">
				<Label htmlFor="title">Title</Label>
				<Input id="title" {...register("title")} placeholder="Mid-term exams begin Monday…" />
				{errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label>Type</Label>
					<Select value={values.type ?? ""} onValueChange={(v) => setValue("type", v as SendNotificationFormValues["type"], { shouldValidate: true })}>
						<SelectTrigger>
							<SelectValue placeholder="Select">
								{(v: string | null) => v ? NOTIFICATION_TYPE_LABELS[v as keyof typeof NOTIFICATION_TYPE_LABELS] : "Select"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
						</SelectContent>
					</Select>
					{errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
				</div>

				<div className="space-y-1.5">
					<Label>Audience</Label>
					<Select value={values.targetType ?? ""} onValueChange={(v) => setValue("targetType", v as SendNotificationFormValues["targetType"], { shouldValidate: true })}>
						<SelectTrigger>
							<SelectValue placeholder="Select">
								{(v: string | null) => v ? TARGET_TYPE_LABELS[v as keyof typeof TARGET_TYPE_LABELS] : "Select"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{(["ALL_PARENTS", "ALL_STUDENTS", "ALL_STAFF", "EVERYONE"] as const).map((v) => (
								<SelectItem key={v} value={v}>{TARGET_TYPE_LABELS[v]}</SelectItem>
							))}
						</SelectContent>
					</Select>
					{errors.targetType && <p className="text-xs text-destructive">{errors.targetType.message}</p>}
				</div>
			</div>

			<div className="space-y-1.5">
				<Label>Channels</Label>
				<div className="flex gap-2">
					{ALL_CHANNELS.map((channel) => (
						<button
							key={channel}
							type="button"
							onClick={() => toggleChannel(channel)}
							className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
								values.channels?.includes(channel)
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-muted-foreground hover:bg-muted"
							}`}
						>
							{CHANNEL_LABELS[channel]}
						</button>
					))}
				</div>
				{errors.channels && <p className="text-xs text-destructive">{errors.channels.message}</p>}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="message">Message</Label>
				<Textarea id="message" rows={5} {...register("message")} placeholder="Message body…" />
				{errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
			</div>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				<Radio className="size-4" /> {isSubmitting ? "Sending…" : "Send now"}
			</Button>
		</form>
	);
}