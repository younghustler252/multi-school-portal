"use client";

import { useEffect, useState } from "react";
import { currentDeployment, schoolSubdomainOf } from "./deployment";

/** The school subdomain of the page being viewed (null on the platform, admin and custom-domain hosts). Resolved after mount. */
export function useCurrentSubdomain(): string | null {
	const [subdomain, setSubdomain] = useState<string | null>(null);
	useEffect(() => {
		setSubdomain(schoolSubdomainOf(window.location.hostname, currentDeployment()));
	}, []);
	return subdomain;
}
