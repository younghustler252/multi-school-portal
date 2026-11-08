"use client";

import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { superAdminApi } from "../services/super-admin.api";
import { isSafeSchoolUrl } from "@/lib/auth/safe-url";
import { ApiErrorResponse } from "@/types/api-response";

export function ImpersonateButton({ schoolId }: { schoolId: string; subdomain?: string }) {
	const [loading, setLoading] = useState(false);

	async function handleImpersonate() {
		setLoading(true);
		try {
			const res = await superAdminApi.impersonateSchool(schoolId);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			// The API returns the school's own address with a one-time, 60-second ticket (never a token in the URL).
			const { redirectUrl } = res.data;
			if (!isSafeSchoolUrl(redirectUrl)) {
				toast.error("The school's address is not valid.");
				return;
			}
			window.location.href = redirectUrl;
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't start impersonation");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Button size="sm" variant="ghost" className="gap-1" onClick={handleImpersonate} disabled={loading}>
			{loading ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3" />} Impersonate
		</Button>
	);
}