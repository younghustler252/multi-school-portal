"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/ui/image-upload-fields";
import { SettingsSection } from "./settings-section";
import { useMySchool, useUpdateMySchool } from "@/features/school/hooks/use-school";
import { useSchoolSettings } from "../../hooks/use-school.settings";
import { schoolApi } from "@/features/school/services/school.api";
import { schoolSettingsApi } from "../../services/school-settings.api";
import { schoolProfileSchema, SchoolProfileFormValues } from "@/features/school/schemas/school-profile.schema";
import { ApiErrorResponse } from "@/types/api-response";

export function ProfileTab() {
	const { data: school, isLoading } = useMySchool();
	const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings()
	const updateSchool = useUpdateMySchool();
	const logoInputRef = useRef<HTMLInputElement>(null);
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [stampUrl, setStampUrl] = useState<string | null>(null);
	const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isDirty },
	} = useForm<SchoolProfileFormValues>({
		resolver: zodResolver(schoolProfileSchema),
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

	if (isLoading || settingsLoading) return <Skeleton className="h-96 rounded-xl" />;

	const values = watch();

	return (
		<>
			<SettingsSection title="School logo">
				<div className="flex items-center gap-4">
					<div className="grid size-16 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
						{logoUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={logoUrl} alt="School logo" className="size-full object-cover" />
						) : (
							<span className="text-xs text-muted-foreground">No logo</span>
						)}
					</div>
					<div>
						<input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
						<Button variant="outline" size="sm" disabled={isUploadingLogo} onClick={() => logoInputRef.current?.click()}>
							{isUploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
							{isUploadingLogo ? "Uploading…" : "Upload logo"}
						</Button>
						<p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				title="School documents"
				description="Upload the official school stamp and principal signature used on school documents"
			>
				<div className="grid gap-4 md:grid-cols-2">
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
			</SettingsSection>

			<SettingsSection
				title="School details"
				description="Public-facing details shown on report cards and invoices"
				actions={
					<Button type="submit" form="profile-form" size="sm" disabled={!isDirty || updateSchool.isPending}>
						{updateSchool.isPending && <Loader2 className="size-4 animate-spin" />}
						{updateSchool.isPending ? "Saving…" : "Save changes"}
					</Button>
				}
			>
				<form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
					<div className="space-y-1.5 md:col-span-2">
						<Label htmlFor="name">School name</Label>
						<Input id="name" {...register("name")} />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="email">School email</Label>
						<Input id="email" type="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" {...register("phone")} />
					</div>

					<div className="space-y-1.5 md:col-span-2">
						<Label htmlFor="address">Address</Label>
						<Input id="address" {...register("address")} />
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="city">City</Label>
						<Input id="city" {...register("city")} />
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="state">State</Label>
						<Input id="state" {...register("state")} />
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="country">Country</Label>
						<Input id="country" {...register("country")} />
						{errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="timezone">Timezone</Label>
						<Input id="timezone" {...register("timezone")} />
						{errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label>School category</Label>
						<Select
							value={values.schoolCategory}
							onValueChange={(v) => setValue("schoolCategory", v as SchoolProfileFormValues["schoolCategory"], { shouldDirty: true })}
						>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="primary">Primary</SelectItem>
								<SelectItem value="secondary">Secondary</SelectItem>
								<SelectItem value="primary_secondary">Primary & Secondary</SelectItem>
							</SelectContent>
						</Select>
						{errors.schoolCategory && <p className="text-xs text-destructive">{errors.schoolCategory.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label>Ownership</Label>
						<Select
							value={values.schoolOwnership}
							onValueChange={(v) => setValue("schoolOwnership", v as SchoolProfileFormValues["schoolOwnership"], { shouldDirty: true })}
						>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="private">Private</SelectItem>
								<SelectItem value="public">Public</SelectItem>
								<SelectItem value="mission">Mission</SelectItem>
								<SelectItem value="international">International</SelectItem>
							</SelectContent>
						</Select>
						{errors.schoolOwnership && <p className="text-xs text-destructive">{errors.schoolOwnership.message}</p>}
					</div>
				</form>
			</SettingsSection>
		</>
	);
}
