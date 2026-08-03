"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api/query-client";
import { ThemeProvider } from "@/components/layout/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>{children}</ThemeProvider>
		</QueryClientProvider>
	);
}