"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformSettings, useUpdatePlatformSettings, useUploadPlatformLogo, useRemovePlatformLogo } from "@/features/super-admin/hooks/use-platform-settings";
import { UpdatePlatformSettingsDto } from "@/features/super-admin/types/platform-settings.types";
import { ApiErrorResponse } from "@/types/api-response";

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** "" -> null (clear it); a link must be https. Returns the value to send, or an error message. */
function linkValue(raw: string | null | undefined): { value: string | null } | { error: string } {
	const v = (raw ?? "").trim();
	if (!v) return { value: null };
	try {
		const u = new URL(v);
		if (u.protocol === "https:" && !u.username && !u.password) return { value: v };
	} catch { /* falls through to the message */ }
	return { error: "Links must be full https:// addresses" };
}

export default function PlatformSettingsPage() {
	const { data: settings, isLoading } = usePlatformSettings();
	const updateSettings = useUpdatePlatformSettings();
	const uploadLogo = useUploadPlatformLogo();
	const removeLogo = useRemovePlatformLogo();
	const fileInput = useRef<HTMLInputElement>(null);

	const [form, setForm] = useState<UpdatePlatformSettingsDto>({});

	useEffect(() => {
		if (!settings) return;
		setForm({
			platformName: settings.platformName,
			supportEmail: settings.supportEmail,
			supportPhone: settings.supportPhone ?? "",
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

	async function handleLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";   // so the same file can be picked again
		if (!file) return;
		if (!LOGO_TYPES.includes(file.type)) { toast.error("Choose a JPEG, PNG or WebP image"); return; }
		if (file.size > LOGO_MAX_BYTES) { toast.error("The logo must be 2 MB or smaller"); return; }
		try {
			await uploadLogo.mutateAsync(file);
			toast.success("Logo updated");
		} catch (err) {
			toast.error((err as ApiErrorResponse).message || "Couldn't upload the logo");
		}
	}

	async function handleLogoRemove() {
		try {
			await removeLogo.mutateAsync();
			toast.success("Logo removed");
		} catch (err) {
			toast.error((err as ApiErrorResponse).message || "Couldn't remove the logo");
		}
	}

	async function handleSave() {
		try {
			const terms = linkValue(form.termsUrl);
			const privacy = linkValue(form.privacyPolicyUrl);
			if ("error" in terms || "error" in privacy) { toast.error("Links must be full https:// addresses"); return; }

			// Strip empty-string optionals back to undefined so we don't
			// overwrite a null field with an empty string unintentionally.
			// The two legal links are different: empty means "clear it", so they go as null.
			const payload: UpdatePlatformSettingsDto = {
				...form,
				supportPhone: form.supportPhone || undefined,
				termsUrl: terms.value,
				privacyPolicyUrl: privacy.value,
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
					<Field label="Logo">
						<div className="flex items-center gap-4">
							<div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
								{settings?.logoUrl ? (
									// A plain <img> on purpose: a preview must never crash the page if an older value points at another host.
									// eslint-disable-next-line @next/next/no-img-element
									<img src={settings.logoUrl} alt="Platform logo" className="size-full object-contain" />
								) : (
									<ImagePlus className="size-5 text-muted-foreground" />
								)}
							</div>
							<div className="space-y-2">
								<input ref={fileInput} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={handleLogoPicked} />
								<div className="flex flex-wrap gap-2">
									<Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploadLogo.isPending || removeLogo.isPending}>
										{uploadLogo.isPending && <Loader2 className="size-4 animate-spin" />}
										{settings?.logoUrl ? "Replace logo" : "Upload logo"}
									</Button>
									{settings?.logoUrl && (
										<Button type="button" variant="ghost" size="sm" onClick={handleLogoRemove} disabled={uploadLogo.isPending || removeLogo.isPending}>
											{removeLogo.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
											Remove
										</Button>
									)}
								</div>
								<p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 2 MB. Saved straight away; no need to press Save changes.</p>
							</div>
						</div>
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