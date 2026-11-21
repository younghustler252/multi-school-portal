"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ui.sidebar.collapsed";

/*
| Sidebar open/collapsed state for a shell.
|   open        mobile sheet, never remembered
|   collapsed   desktop icon rail, remembered per browser as a convenience only. Storage can be blocked or empty, so every
|               access is guarded and the shell is correct (expanded) without it. Nothing important depends on it.
| The saved value is applied after mount so the server and first client render agree.
*/
export function useSidebarState() {
	const [open, setOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		try {
			if (window.localStorage.getItem(KEY) === "1") setCollapsed(true);
		} catch {
			/* storage unavailable: stay expanded */
		}
	}, []);

	const toggleCollapsed = useCallback(() => {
		setCollapsed((current) => {
			const next = !current;
			try {
				window.localStorage.setItem(KEY, next ? "1" : "0");
			} catch {
				/* not remembered; still works for this visit */
			}
			return next;
		});
	}, []);

	return { open, openSidebar: () => setOpen(true), closeSidebar: () => setOpen(false), collapsed, toggleCollapsed };
}
