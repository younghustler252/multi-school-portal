// src/components/layout/install-app-prompt.tsx
"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallAppPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		function handler(e: Event) {
			e.preventDefault();
			setDeferredPrompt(e);
			setVisible(true);
		}
		window.addEventListener("beforeinstallprompt", handler);
		return () => window.removeEventListener("beforeinstallprompt", handler);
	}, []);

	if (!visible) return null;

	return (
		<div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
			<span className="text-sm">Install SchoolOS for quick access</span>
			<Button size="sm" onClick={async () => { deferredPrompt?.prompt(); setVisible(false); }}>
				<Download className="size-3.5" /> Install
			</Button>
		</div>
	);
}