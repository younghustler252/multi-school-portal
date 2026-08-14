"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/features/school/components/settings/settings-section";
import { useGradingConfig, useUpdateGradingConfig } from "../hooks/use-grades";
import { gradingConfigSchema, GradingConfigFormValues } from "../schemas/grading-config.schema";
import { ApiErrorResponse } from "@/types/api-response";
import { FeatureGate } from "@/components/feedback/feature-gate";

const WAEC_DEFAULT: GradingConfigFormValues["configs"] = [
	{ grade: "A1", remark: "Excellent", minScore: "75", maxScore: "100" },
	{ grade: "B2", remark: "Very Good", minScore: "70", maxScore: "74" },
	{ grade: "B3", remark: "Good", minScore: "65", maxScore: "69" },
	{ grade: "C4", remark: "Credit", minScore: "60", maxScore: "64" },
	{ grade: "C5", remark: "Credit", minScore: "55", maxScore: "59" },
	{ grade: "C6", remark: "Credit", minScore: "50", maxScore: "54" },
	{ grade: "D7", remark: "Pass", minScore: "45", maxScore: "49" },
	{ grade: "E8", remark: "Pass", minScore: "40", maxScore: "44" },
	{ grade: "F9", remark: "Fail", minScore: "0", maxScore: "39" },
];

export function GradingConfigTab() {
	const { data: existingConfig, isLoading } = useGradingConfig();
	const updateConfig = useUpdateGradingConfig();

	const {
		register,
		control,
		handleSubmit,
		reset,
		formState: { errors, isDirty },
	} = useForm<GradingConfigFormValues>({
		resolver: zodResolver(gradingConfigSchema),
		defaultValues: { configs: WAEC_DEFAULT },
	});

	const { fields, append, remove, replace } = useFieldArray({ control, name: "configs" });

	useEffect(() => {
		if (existingConfig && existingConfig.length > 0) {
			reset({
				configs: existingConfig.map((c) => ({
					grade: c.grade,
					remark: c.remark,
					minScore: String(c.minScore),
					maxScore: String(c.maxScore),
				})),
			});
		}
	}, [existingConfig, reset]);

	async function onSubmit(values: GradingConfigFormValues) {
		try {
			await updateConfig.mutateAsync({
				configs: values.configs.map((c) => ({
					grade: c.grade,
					remark: c.remark,
					minScore: Number(c.minScore),
					maxScore: Number(c.maxScore),
				})),
			});
			toast.success("Grading scale updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save grading scale — this feature may require the Pro plan.");
		}
	}

	if (isLoading) {
		return (
			<SettingsSection title="Grading scale" description="Configure custom grade bands for your school.">
				<Skeleton className="h-64 rounded-lg" />
			</SettingsSection>
		);
	}

	return (
		<SettingsSection
			title="Grading scale"
			description="Edit score ranges, letter grades and remarks used across all report cards. Requires the Pro plan."
			actions={
				<Button variant="outline" size="sm" onClick={() => { replace(WAEC_DEFAULT); toast("Reset to WAEC default"); }}>
					<RotateCcw className="size-3.5" /> Reset default
				</Button>
			}
		>
			<FeatureGate feature="customGrading" featureName="Custom grading">	

				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="overflow-hidden rounded-lg border border-border">
						<table className="w-full text-sm">
							<thead className="bg-muted/40 text-xs text-muted-foreground">
								<tr>
									<th className="px-3 py-2 text-left">Grade</th>
									<th className="px-3 py-2 text-left">Min</th>
									<th className="px-3 py-2 text-left">Max</th>
									<th className="px-3 py-2 text-left">Remark</th>
									<th className="w-10" />
								</tr>
							</thead>
							<tbody>
								{fields.map((field, index) => (
									<tr key={field.id} className="border-t border-border">
										<td className="px-3 py-2">
											<Input className="h-8 w-16" {...register(`configs.${index}.grade`)} />
										</td>
										<td className="px-3 py-2">
											<Input type="number" className="h-8 w-20" {...register(`configs.${index}.minScore`)} />
										</td>
										<td className="px-3 py-2">
											<Input type="number" className="h-8 w-20" {...register(`configs.${index}.maxScore`)} />
										</td>
										<td className="px-3 py-2">
											<Input className="h-8" {...register(`configs.${index}.remark`)} />
										</td>
										<td className="px-2 py-2">
											<Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}>
												<Trash2 className="size-4 text-muted-foreground" />
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{errors.configs?.message && <p className="mt-2 text-xs text-destructive">{errors.configs.message}</p>}

					<div className="mt-3 flex items-center justify-between">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ grade: "", remark: "", minScore: "0", maxScore: "0" })}
						>
							<Plus className="size-3.5" /> Add band
						</Button>

						<Button type="submit" size="sm" disabled={!isDirty || updateConfig.isPending}>
							{updateConfig.isPending && <Loader2 className="size-4 animate-spin" />}
							{updateConfig.isPending ? "Saving…" : "Save changes"}
						</Button>
					</div>
				</form>
			</FeatureGate>
		</SettingsSection>
	);
}