import type { ReactNode } from "react";

interface SettingsSectionProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
}

export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="font-medium">{title}</div>
					{description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
				</div>
				{actions}
			</div>
			{children}
		</div>
	);
}