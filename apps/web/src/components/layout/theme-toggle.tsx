"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Light/dark switch. Follows the theme that is actually showing, so it also behaves when the theme is "system". */
export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => { setMounted(true); }, []);

	// Until mounted the real theme is unknown on the server, so render the neutral state to avoid a hydration mismatch.
	const dark = mounted && resolvedTheme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={() => setTheme(dark ? "light" : "dark")}
			aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
		>
			{dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
		</Button>
	);
}
