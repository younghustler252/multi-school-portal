import { Sparkles } from "lucide-react";
import { SettingsSection } from "./settings-section";

export function ComingSoonTab({ title, description }: { title: string; description: string }) {
	return (
		<SettingsSection title={title} description={description}>
			<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
				<Sparkles className="size-5 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">This is coming soon.</p>
			</div>
		</SettingsSection>
	);
}