"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useResetAdminPassword } from "../hooks/use-school-management";
import { ApiErrorResponse } from "@/types/api-response";

export function ResetAdminPasswordButton({ schoolId }: { schoolId: string }) {
	const resetPassword = useResetAdminPassword();
	const [confirmOpen, setConfirmOpen] = useState(false);

	async function handleConfirm() {
		try {
			const res = await resetPassword.mutateAsync(schoolId);
			toast.success(res.data.message);
			setConfirmOpen(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't reset password");
		}
	}

	return (
		<>
			<Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirmOpen(true)}>
				<KeyRound className="size-3.5" /> Reset admin password
			</Button>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="Reset admin password?"
				description="This resets the password for this school's admin account. They'll need to use the new credentials or a reset link to log in again, depending on how your backend delivers it."
				confirmLabel="Reset password"
				destructive
				isLoading={resetPassword.isPending}
				onConfirm={handleConfirm}
			/>
		</>
	);
}