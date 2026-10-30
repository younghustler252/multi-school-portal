"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";

export function AuthProvider({
	children,
}: {
	children: ReactNode;
}) {
	const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
	const [isHydrating, setIsHydrating] = useState(true);

	useEffect(() => {
		fetchCurrentUser().finally(() => setIsHydrating(false));
	}, [fetchCurrentUser]);

	if (isHydrating) {
		return null;
	}

	return <>{children}</>;
}