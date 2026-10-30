"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "./settings-section";
import { FeatureGate } from "@/components/feedback/feature-gate";
import { TemplatePreviewCard } from "./template-preview-card";
import { useSchoolSettings, useUpdateSchoolSettings } from "../../hooks/use-school.settings";
import { schoolSettingsApi } from "@/features/school/services/school-settings.api";
import { ReportCardTemplate } from "@/features/school/types/school-settings.types";
import { ApiErrorResponse } from "@/types/api-response";

const TEMPLATES: ReportCardTemplate[] = ["classic", "modern", "minimal", "custom_letterhead"];

export function ReportCardTemplateTab() {
	const { data: settings, isLoading } = useSchoolSettings();
	const updateSettings = useUpdateSchoolSettings();
	const [selected, setSelected] = useState<ReportCardTemplate>("classic");
	const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
	const [topMm, setTopMm] = useState("50");
	const [bottomMm, setBottomMm] = useState("30");
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (settings) {
			setSelected(settings.reportCardTemplate ?? "classic");
			setLetterheadUrl(settings.reportCardLetterheadUrl);
			setTopMm(String(settings.letterheadContentTopMm ?? 50));
			setBottomMm(String(settings.letterheadContentBottomMm ?? 30));
		}
	}, [settings]);

	async function handleSelectTemplate(template: ReportCardTemplate) {
		setSelected(template);
		try {
			await updateSettings.mutateAsync({ reportCardTemplate: template });
			toast.success("Template updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update template");
			setSelected(settings?.reportCardTemplate ?? "classic"); // revert on failure
		}
	}

	async function handleLetterheadUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setIsUploading(true);
		try {
			const res = await schoolSettingsApi.uploadLetterhead(file);
			if (res.success) {
				setLetterheadUrl(res.data.url);
				toast.success("Letterhead uploaded");
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error("Couldn't upload letterhead");
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	async function handleSaveMargins() {
		try {
			await updateSettings.mutateAsync({
				letterheadContentTopMm: Number(topMm),
				letterheadContentBottomMm: Number(bottomMm),
			});
			toast.success("Margins saved");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save margins");
		}
	}

	if (isLoading) {
		return (
			<SettingsSection title="Report card template">
				<Skeleton className="h-64 rounded-lg" />
			</SettingsSection>
		);
	}

	return (
		<SettingsSection
			title="Report card template"
			description="Choose how your school's report cards look when generated."
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<TemplatePreviewCard template="classic" selected={selected === "classic"} onSelect={() => handleSelectTemplate("classic")} />
				<TemplatePreviewCard template="modern" selected={selected === "modern"} onSelect={() => handleSelectTemplate("modern")} />
				<TemplatePreviewCard template="minimal" selected={selected === "minimal"} onSelect={() => handleSelectTemplate("minimal")} />

				<FeatureGate feature="customReportCardTemplate" featureName="Custom letterhead">
					<TemplatePreviewCard
						template="custom_letterhead"
						selected={selected === "custom_letterhead"}
						onSelect={() => handleSelectTemplate("custom_letterhead")}
					/>
				</FeatureGate>
			</div>

			{selected === "custom_letterhead" && (
				<div className="mt-6 space-y-4 rounded-lg border border-border p-4">
					<div>
						<Label>Letterhead image</Label>
						<div className="mt-2 flex items-center gap-3">
							{letterheadUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={letterheadUrl} alt="Letterhead" className="h-20 rounded border border-border object-contain" />
							)}
							<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
							<Button variant="outline" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
								{isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
								{letterheadUrl ? "Replace" : "Upload"}
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="topMm">Content top margin (mm)</Label>
							<Input id="topMm" type="number" value={topMm} onChange={(e) => setTopMm(e.target.value)} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="bottomMm">Content bottom margin (mm)</Label>
							<Input id="bottomMm" type="number" value={bottomMm} onChange={(e) => setBottomMm(e.target.value)} />
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						These margins define where result content is placed on your letterhead image, so it doesn&apos;t overlap your header/footer design.
					</p>

					<Button size="sm" onClick={handleSaveMargins} disabled={updateSettings.isPending}>
						{updateSettings.isPending && <Loader2 className="size-4 animate-spin" />}
						Save margins
					</Button>
				</div>
			)}
		</SettingsSection>
	);
}