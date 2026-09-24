"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, Camera, Building2, MapPin, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/ui/image-upload-fields";
import { useMySchool, useUpdateMySchool } from "@/features/school/hooks/use-school";
import { useSchoolSettings } from "../../hooks/use-school.settings";
import { schoolApi } from "@/features/school/services/school.api";
import { schoolSettingsApi } from "../../services/school-settings.api";
import { schoolProfileSchema, SchoolProfileFormValues } from "@/features/school/schemas/school-profile.schema";
import { ApiErrorResponse } from "@/types/api-response";

export function ProfileTab() {
	const { data: school, isLoading } = useMySchool();
	const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
	const updateSchool = useUpdateMySchool();
	const logoInputRef = useRef<HTMLInputElement>(null);
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [stampUrl, setStampUrl] = useState<string | null>(null);
	const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

	const {
		register, handleSubmit, reset, setValue, watch,
		formState: { errors, isDirty },
	} = useForm<SchoolProfileFormValues>({
		resolver: zodResolver(schoolProfileSchema),
		defaultValues: {
			name: "", email: "", phone: "", address: "", city: "", state: "",
			country: "", timezone: "", schoolCategory: "primary", schoolOwnership: "private",
		},
	});

	useEffect(() => {
		if (school) {
			reset({
				name: school.name,
				email: school.email,
				phone: school.phone ?? "",
				address: school.address ?? "",
				city: school.city ?? "",
				state: school.state ?? "",
				country: school.country,
				timezone: school.timezone,
				schoolCategory: school.schoolCategory as SchoolProfileFormValues["schoolCategory"],
				schoolOwnership: school.schoolOwnership as SchoolProfileFormValues["schoolOwnership"],
			});
			setLogoUrl(school.logoUrl);
		}
	}, [school, reset]);

	useEffect(() => {
		if (schoolSettings) {
			setStampUrl(schoolSettings.stamp ?? null);
			setSignatureUrl(schoolSettings.signature ?? null);
		}
	}, [schoolSettings]);

	async function onSubmit(values: SchoolProfileFormValues) {
		try {
			await updateSchool.mutateAsync(values);
			toast.success("School profile updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setIsUploadingLogo(true);
		try {
			const res = await schoolApi.uploadLogo(file);
			if (res.success) {
				setLogoUrl(res.data.url);
				toast.success("Logo updated");
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error("Couldn't upload logo");
		} finally {
			setIsUploadingLogo(false);
			if (logoInputRef.current) logoInputRef.current.value = "";
		}
	}

	if (isLoading || settingsLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-32 rounded-2xl" />
				<Skeleton className="h-48 rounded-2xl" />
				<Skeleton className="h-96 rounded-2xl" />
			</div>
		);
	}

	const values = watch();

	return (
		<div className="space-y-5 pb-24 sm:pb-0">
			{/* Hero card — logo + school identity */}
			<div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
				<div className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
					<div className="group relative shrink-0">
						<div className="grid size-24 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm sm:size-20">
							{logoUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={logoUrl} alt="School logo" className="size-full object-cover" />
							) : (
								<Building2 className="size-8 text-muted-foreground/50" />
							)}
						</div>
						<input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
						<button
							type="button"
							onClick={() => logoInputRef.current?.click()}
							disabled={isUploadingLogo}
							className="absolute -bottom-1.5 -right-1.5 grid size-8 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
							aria-label="Change logo"
						>
							{isUploadingLogo ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
						</button>
					</div>
					<div>
						<div className="text-lg font-semibold tracking-tight">{school?.name}</div>
						<div className="mt-0.5 text-sm text-muted-foreground">{school?.email}</div>
						<div className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 5MB</div>
					</div>
				</div>
			</div>

			{/* School documents */}
			<Section icon={FileSignature} title="School documents" description="Used on report cards and invoices">
				<div className="grid gap-4 sm:grid-cols-2">
					<ImageUploadField
						label="School stamp"
						currentUrl={stampUrl}
						uploadFn={schoolSettingsApi.uploadStamp}
						onUploaded={(url) => setStampUrl(url)}
						shape="square"
					/>
					<ImageUploadField
						label="Principal signature"
						currentUrl={signatureUrl}
						uploadFn={schoolSettingsApi.uploadSignature}
						onUploaded={(url) => setSignatureUrl(url)}
						shape="wide"
					/>
				</div>
			</Section>

			{/* Details form */}
			<form id="profile-form" onSubmit={handleSubmit(onSubmit)}>
				<Section icon={MapPin} title="School details" description="Public-facing details shown across the platform">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="School name" error={errors.name?.message} className="sm:col-span-2">
							<Input {...register("name")} className="h-11" />
						</Field>

						<Field label="School email" error={errors.email?.message}>
							<Input type="email" {...register("email")} className="h-11" />
						</Field>

						<Field label="Phone">
							<Input {...register("phone")} className="h-11" />
						</Field>

						<Field label="Address" className="sm:col-span-2">
							<Input {...register("address")} className="h-11" />
						</Field>

						<Field label="City">
							<Input {...register("city")} className="h-11" />
						</Field>

						<Field label="State">
							<Input {...register("state")} className="h-11" />
						</Field>

						<Field label="Country" error={errors.country?.message}>
							<Input {...register("country")} className="h-11" />
						</Field>

						<Field label="Timezone" error={errors.timezone?.message}>
							<Input {...register("timezone")} className="h-11" />
						</Field>

						<Field label="School category" error={errors.schoolCategory?.message}>
							<Select
								value={values.schoolCategory}
								onValueChange={(v) => setValue("schoolCategory", v as SchoolProfileFormValues["schoolCategory"], { shouldDirty: true })}
							>
								<SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="primary">Primary</SelectItem>
									<SelectItem value="secondary">Secondary</SelectItem>
									<SelectItem value="primary_secondary">Primary & Secondary</SelectItem>
								</SelectContent>
							</Select>
						</Field>

						<Field label="Ownership" error={errors.schoolOwnership?.message}>
							<Select
								value={values.schoolOwnership}
								onValueChange={(v) => setValue("schoolOwnership", v as SchoolProfileFormValues["schoolOwnership"], { shouldDirty: true })}
							>
								<SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="private">Private</SelectItem>
									<SelectItem value="public">Public</SelectItem>
									<SelectItem value="mission">Mission</SelectItem>
									<SelectItem value="international">International</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					</div>
				</Section>
			</form>

			{/* Save bar — fixed on mobile, inline on desktop */}
			<div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
				<div className="flex justify-end">
					<Button
						type="submit"
						form="profile-form"
						className="w-full sm:w-auto"
						disabled={!isDirty || updateSchool.isPending}
					>
						{updateSchool.isPending && <Loader2 className="size-4 animate-spin" />}
						{updateSchool.isPending ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function Section({
	icon: Icon, title, description, children,
}: { icon: React.ElementType; title: string; description?: string; children: React.ReactNode }) {
	return (
		<div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6">
			<div className="mb-4 flex items-start gap-3">
				<div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
					<Icon className="size-4.5" />
				</div>
				<div>
					<h3 className="font-medium">{title}</h3>
					{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
				</div>
			</div>
			{children}
		</div>
	);
}

function Field({
	label, error, children, className,
}: { label: string; error?: string; children: React.ReactNode; className?: string }) {
	return (
		<div className={`space-y-1.5 ${className ?? ""}`}>
			<Label className="text-xs text-muted-foreground">{label}</Label>
			{children}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}