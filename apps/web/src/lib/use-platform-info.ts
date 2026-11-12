"use client";

import { useMemo } from "react";
import { DEFAULT_COMPANY, type CompanyConfig } from "@/config/company";
import { mergePlatformInfo } from "@/lib/platform-info";
import { usePlatformSettings } from "@/features/super-admin/hooks/use-platform-settings";

/*
| The platform's own name, logo, support contact and legal links, from the platform API.
| Same query as the super-admin settings page, so saving a change there updates every screen straight away.
| Falls back to the defaults while loading or if the API cannot be reached.
*/
export function usePlatformInfo(): CompanyConfig {
	const { data } = usePlatformSettings();
	return useMemo(() => mergePlatformInfo(DEFAULT_COMPANY, data), [data]);
}
