"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PlanEntitlementView } from "../types/plan.types";
import type { DraftMap, FeatureDraft } from "../lib/plan-admin";

interface PlanFeaturesEditorProps {
	features: PlanEntitlementView[];
	drafts: DraftMap;
	onChange: (key: string, next: FeatureDraft) => void;
	disabled?: boolean;
}

/** Every feature definition, grouped by module, with what this plan grants. Switch = included; limits also take a number or "unlimited". */
export function PlanFeaturesEditor({ features, drafts, onChange, disabled }: PlanFeaturesEditorProps) {
	const modules = [...new Set(features.map((f) => f.module))];

	return (
		<div className="space-y-5">
			{modules.map((module) => (
				<section key={module}>
					<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</h4>
					<ul className="divide-y divide-border rounded-lg border border-border">
						{features.filter((f) => f.module === module).map((f) => {
							const d = drafts[f.key];
							if (!d) return null;
							const numeric = f.kind === "LIMIT" || f.kind === "QUOTA";
							return (
								<li key={f.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">
											{f.name}
											{!f.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(not enforced yet)</span>}
										</p>
										{f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
									</div>
									{d.included && numeric && (
										<div className="flex items-center gap-2">
											<Input
												aria-label={`${f.name} amount`}
												inputMode="numeric"
												className="h-8 w-24"
												disabled={disabled || d.unlimited}
												value={d.unlimited ? "" : d.value}
												placeholder={d.unlimited ? "∞" : "0"}
												onChange={(e) => onChange(f.key, { ...d, value: e.target.value })}
											/>
											{f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
											<label className="flex items-center gap-1.5 text-xs">
												<Switch size="sm" disabled={disabled} checked={d.unlimited} onCheckedChange={(v) => onChange(f.key, { ...d, unlimited: v })} />
												Unlimited
											</label>
										</div>
									)}
									{d.included && f.kind === "ENUM" && (
										<Input aria-label={`${f.name} value`} className="h-8 w-40" disabled={disabled} value={d.value} onChange={(e) => onChange(f.key, { ...d, value: e.target.value })} />
									)}
									<Switch aria-label={`Include ${f.name}`} disabled={disabled} checked={d.included} onCheckedChange={(v) => onChange(f.key, { ...d, included: v })} />
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
