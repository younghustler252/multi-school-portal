"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
	useEffect(() => {
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("/sw.js").catch(() => {
				// silent — PWA install just won't be offered, not a functional break
			});
		}
	}, []);
	return null;
}