"use client";

import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { superAdminApi } from "../services/super-admin.api";
import { COMPANY } from "@/config/company";
import { ApiErrorResponse } from "@/types/api-response";

export function ImpersonateButton({ schoolId, subdomain }: { schoolId: string; subdomain: string }) {
	const [loading, setLoading] = useState(false);

	async function handleImpersonate() {
		setLoading(true);
		try {
			const res = await superAdminApi.impersonateSchool(schoolId);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			const { accessToken } = res.data;
			const host = new URL(COMPANY.website).hostname;
			const isLocal = window.location.hostname.endsWith(".localhost");
			const target = isLocal
				? `http://${subdomain}.localhost:3000/impersonate-entry?token=${accessToken}`
				: `https://${subdomain}.${host}/impersonate-entry?token=${accessToken}`;
			window.location.href = target;
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't start impersonation");
			setLoading(false);
		}
	}

	return (
		<Button size="sm" variant="ghost" className="gap-1" onClick={handleImpersonate} disabled={loading}>
			{loading ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3" />} Impersonate
		</Button>
	);
}