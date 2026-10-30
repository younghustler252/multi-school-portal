"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformSettings, useUpdatePlatformSettings } from "@/features/super-admin/hooks/use-platform-settings";
import { UpdatePlatformSettingsDto } from "@/features/super-admin/types/platform-settings.types";
import { ApiErrorResponse } from "@/types/api-response";

export default function PlatformSettingsPage() {
	const { data: settings, isLoading } = usePlatformSettings();
	const updateSettings = useUpdatePlatformSettings();

	const [form, setForm] = useState<UpdatePlatformSettingsDto>({});

	useEffect(() => {
		if (!settings) return;
		setForm({
			platformName: settings.platformName,
			supportEmail: settings.supportEmail,
			supportPhone: settings.supportPhone ?? "",
			logoUrl: settings.logoUrl ?? "",
			termsUrl: settings.termsUrl ?? "",
			privacyPolicyUrl: settings.privacyPolicyUrl ?? "",
			subscriptionGracePeriodDays: settings.subscriptionGracePeriodDays,
			reminderDaysBeforeExpiry: settings.reminderDaysBeforeExpiry,
			defaultTrialDays: settings.defaultTrialDays,
			allowNewRegistrations: settings.allowNewRegistrations,
			maintenanceMode: settings.maintenanceMode,
			maintenanceMessage: settings.maintenanceMessage ?? "",
			announcementBanner: settings.announcementBanner ?? "",
		});
	}, [settings]);

	function update<K extends keyof UpdatePlatformSettingsDto>(key: K, value: UpdatePlatformSettingsDto[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	async function handleSave() {
		try {
			// Strip empty-string optionals back to undefined so we don't
			// overwrite a null field with an empty string unintentionally
			const payload: UpdatePlatformSettingsDto = {
				...form,
				supportPhone: form.supportPhone || undefined,
				logoUrl: form.logoUrl || undefined,
				termsUrl: form.termsUrl || undefined,
				privacyPolicyUrl: form.privacyPolicyUrl || undefined,
				maintenanceMessage: form.maintenanceMessage || undefined,
				announcementBanner: form.announcementBanner || undefined,
			};
			await updateSettings.mutateAsync(payload);
			toast.success("Platform settings saved");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save settings");
		}
	}

	if (isLoading) {
		return (
			<>
				<PageHeader title="Platform settings" description="Configure global settings for the SchoolOS platform." />
				<div className="space-y-4">
					<Skeleton className="h-48 rounded-xl" />
					<Skeleton className="h-48 rounded-xl" />
					<Skeleton className="h-32 rounded-xl" />
				</div>
			</>
		);
	}

	return (
		<>
			<PageHeader
				title="Platform settings"
				description="Configure global settings for the SchoolOS platform."
				actions={
					<Button onClick={handleSave} className="w-full sm:w-auto" disabled={updateSettings.isPending}>
						{updateSettings.isPending && <Loader2 className="size-4 animate-spin" />}
						Save changes
					</Button>
				}
			/>

			<div className="space-y-6">
				<Section title="General">
					<Field label="Platform name">
						<Input value={form.platformName ?? ""} onChange={(e) => update("platformName", e.target.value)} />
					</Field>
					<Field label="Logo URL">
						<Input value={form.logoUrl ?? ""} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://…" />
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Support email">
							<Input type="email" value={form.supportEmail ?? ""} onChange={(e) => update("supportEmail", e.target.value)} />
						</Field>
						<Field label="Support phone">
							<Input value={form.supportPhone ?? ""} onChange={(e) => update("supportPhone", e.target.value)} />
						</Field>
					</div>
				</Section>

				<Section title="Legal">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Terms of service URL">
							<Input value={form.termsUrl ?? ""} onChange={(e) => update("termsUrl", e.target.value)} placeholder="https://…" />
						</Field>
						<Field label="Privacy policy URL">
							<Input value={form.privacyPolicyUrl ?? ""} onChange={(e) => update("privacyPolicyUrl", e.target.value)} placeholder="https://…" />
						</Field>
					</div>
				</Section>

				<Section title="Subscriptions & trials">
					<div className="grid gap-4 sm:grid-cols-3">
						<Field label="Grace period (days)">
							<Input
								type="number" min={0} max={90}
								value={form.subscriptionGracePeriodDays ?? 0}
								onChange={(e) => update("subscriptionGracePeriodDays", Number(e.target.value))}
							/>
						</Field>
						<Field label="Reminder before expiry (days)">
							<Input
								type="number" min={0} max={30}
								value={form.reminderDaysBeforeExpiry ?? 0}
								onChange={(e) => update("reminderDaysBeforeExpiry", Number(e.target.value))}
							/>
						</Field>
						<Field label="Default trial length (days)">
							<Input
								type="number" min={0} max={90}
								value={form.defaultTrialDays ?? 0}
								onChange={(e) => update("defaultTrialDays", Number(e.target.value))}
							/>
						</Field>
					</div>
				</Section>

				<Section title="Registration & maintenance">
					<Toggle
						label="Allow new school registrations"
						checked={form.allowNewRegistrations ?? true}
						onCheckedChange={(v) => update("allowNewRegistrations", v)}
					/>
					<Toggle
						label="Maintenance mode"
						description="When on, the platform shows a maintenance message instead of the app."
						checked={form.maintenanceMode ?? false}
						onCheckedChange={(v) => update("maintenanceMode", v)}
					/>
					{form.maintenanceMode && (
						<Field label="Maintenance message">
							<Textarea
								value={form.maintenanceMessage ?? ""}
								onChange={(e) => update("maintenanceMessage", e.target.value)}
								rows={2}
							/>
						</Field>
					)}
					<Field label="Announcement banner (optional)">
						<Textarea
							value={form.announcementBanner ?? ""}
							onChange={(e) => update("announcementBanner", e.target.value)}
							rows={2}
							placeholder="Shown as a banner across the platform, e.g. a scheduled downtime notice"
						/>
					</Field>
				</Section>
			</div>
		</>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-border bg-card/60 p-5 sm:p-6">
			<h3 className="mb-4 font-medium">{title}</h3>
			<div className="space-y-4">{children}</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1.5">
			<Label className="text-xs text-muted-foreground">{label}</Label>
			{children}
		</div>
	);
}

function Toggle({
	label, description, checked, onCheckedChange,
}: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<div className="text-sm font-medium">{label}</div>
				{description && <div className="text-xs text-muted-foreground">{description}</div>}
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}