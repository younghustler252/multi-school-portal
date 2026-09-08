"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSendPlatformNotification } from "../hooks/use-platform-notifications";
import { useAdminSchools } from "../hooks/use-school-management";
import { PLATFORM_NOTIFICATION_TYPE_LABELS } from "../constants/platform-notification-labels";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiErrorResponse } from "@/types/api-response";

const CHANNEL_LABELS = { IN_APP: "In-app", EMAIL: "Email", SMS: "SMS" } as const;
type Channel = keyof typeof CHANNEL_LABELS;

const schema = z.object({
	title: z.string().min(1, "Required").max(100),
	message: z.string().min(1, "Required"),
	type: z.enum([
		"welcome", "feature_announcement", "subscription_expiry", "subscription_renewed",
		"subscription_failed", "account_suspended", "account_verified", "account_rejected", "system_alert",
	]),
	channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1, "Select at least one channel"),
});
type FormValues = z.infer<typeof schema>;

export function ComposePlatformNotificationCard() {
	const sendNotification = useSendPlatformNotification();
	const [audienceMode, setAudienceMode] = useState<"all" | "specific">("all");
	const [selectedSchools, setSelectedSchools] = useState<{ id: string; name: string }[]>([]);
	const [schoolSearch, setSchoolSearch] = useState("");
	const debouncedSearch = useDebouncedValue(schoolSearch, 300);
	const { data: schoolResults } = useAdminSchools({ limit: 10, search: debouncedSearch || undefined });

	const {
		register, handleSubmit, setValue, watch, reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { channels: ["IN_APP"] } });
	const values = watch();

	function toggleChannel(channel: Channel) {
		const current = values.channels ?? [];
		setValue("channels", current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel], { shouldValidate: true });
	}

	function addSchool(id: string, name: string) {
		if (!selectedSchools.some((s) => s.id === id)) setSelectedSchools((prev) => [...prev, { id, name }]);
		setSchoolSearch("");
	}

	function removeSchool(id: string) {
		setSelectedSchools((prev) => prev.filter((s) => s.id !== id));
	}

	async function onSubmit(formValues: FormValues) {
		if (audienceMode === "specific" && selectedSchools.length === 0) {
			toast.error("Select at least one school");
			return;
		}
		try {
			await sendNotification.mutateAsync({
				...formValues,
				schoolIds: audienceMode === "specific" ? selectedSchools.map((s) => s.id) : undefined,
			});
			toast.success("Platform notification sent");
			reset({ channels: ["IN_APP"] });
			setSelectedSchools([]);
			setAudienceMode("all");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send notification");
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
			<div className="font-medium">Compose platform notification</div>

			<div className="space-y-1.5">
				<Label htmlFor="title">Title</Label>
				<Input id="title" {...register("title")} placeholder="Scheduled maintenance…" />
				{errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
			</div>

			<div className="space-y-1.5">
				<Label>Type</Label>
				<Select value={values.type ?? ""} onValueChange={(v) => setValue("type", v as FormValues["type"], { shouldValidate: true })}>
					<SelectTrigger>
						<SelectValue placeholder="Select">
							{(v: string | null) => v ? PLATFORM_NOTIFICATION_TYPE_LABELS[v as keyof typeof PLATFORM_NOTIFICATION_TYPE_LABELS] : "Select"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{Object.entries(PLATFORM_NOTIFICATION_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
					</SelectContent>
				</Select>
				{errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
			</div>

			<div className="space-y-1.5">
				<Label>Audience</Label>
				<div className="flex gap-2">
					<button type="button" onClick={() => setAudienceMode("all")} className={`rounded-full border px-3 py-1.5 text-xs ${audienceMode === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
						All schools
					</button>
					<button type="button" onClick={() => setAudienceMode("specific")} className={`rounded-full border px-3 py-1.5 text-xs ${audienceMode === "specific" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
						Specific schools
					</button>
				</div>

				{audienceMode === "specific" && (
					<div className="mt-2 space-y-2">
						<div className="flex flex-wrap gap-1.5">
							{selectedSchools.map((s) => (
								<Badge key={s.id} variant="secondary" className="gap-1">
									{s.name}
									<button type="button" onClick={() => removeSchool(s.id)}><X className="size-3" /></button>
								</Badge>
							))}
						</div>
						<Input placeholder="Search schools to add…" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)} />
						{schoolSearch && schoolResults && (
							<div className="max-h-32 overflow-y-auto rounded-md border border-border">
								{schoolResults.schools.map((s) => (
									<button key={s.id} type="button" onClick={() => addSchool(s.id, s.name)} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-muted">
										{s.name}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<div className="space-y-1.5">
				<Label>Channels</Label>
				<div className="flex gap-2">
					{(Object.keys(CHANNEL_LABELS) as Channel[]).map((channel) => (
						<button
							key={channel}
							type="button"
							onClick={() => toggleChannel(channel)}
							className={`rounded-full border px-3 py-1.5 text-xs font-medium ${values.channels?.includes(channel) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
						>
							{CHANNEL_LABELS[channel]}
						</button>
					))}
				</div>
				{errors.channels && <p className="text-xs text-destructive">{errors.channels.message}</p>}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="message">Message</Label>
				<Textarea id="message" rows={5} {...register("message")} />
				{errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
			</div>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				<Radio className="size-4" /> {isSubmitting ? "Sending…" : "Send now"}
			</Button>
		</form>
	);
}