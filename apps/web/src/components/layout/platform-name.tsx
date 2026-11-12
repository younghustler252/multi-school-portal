"use client";

import { usePlatformInfo } from "@/lib/use-platform-info";

/** The platform's name as set in platform settings. Works inside server and client components. */
export function PlatformName() {
	return <>{usePlatformInfo().name}</>;
}
