"use client";

import { usePlatformSettings } from "@/features/super-admin/hooks/use-platform-settings";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
	const { data: settings } = usePlatformSettings();

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
			<div className="grid size-14 place-items-center rounded-full bg-muted">
				<Wrench className="size-6 text-muted-foreground" />
			</div>
			<h1 className="text-xl font-semibold">We'll be back shortly</h1>
			<p className="max-w-sm text-sm text-muted-foreground">
				{settings?.maintenanceMessage || "The platform is undergoing scheduled maintenance. Please check back soon."}
			</p>
		</div>
	);
}