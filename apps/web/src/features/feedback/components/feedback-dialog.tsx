"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useSubmitFeedback } from "../hooks/use-feedback";
import { FeedbackType } from "../types/feedback.types";

const TYPE_LABELS: Record<FeedbackType, string> = {
	bug: "Report a bug",
	suggestion: "Suggest something",
	complaint: "Complaint",
	praise: "Praise",
};

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const pathname = usePathname();
	const submitFeedback = useSubmitFeedback();
	const [type, setType] = useState<FeedbackType>("suggestion");
	const [message, setMessage] = useState("");

	async function handleSubmit() {
		if (!message.trim()) return;
		try {
			await submitFeedback.mutateAsync({ type, message: message.trim(), pageUrl: pathname });
			toast.success("Thanks — your feedback has been sent.");
			setMessage("");
			onOpenChange(false);
		} catch {
			toast.error("Couldn't send feedback. Try again in a moment.");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send feedback</DialogTitle>
					<DialogDescription>Tell us what's wrong, what's missing, or what's working well.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Select value={type} onValueChange={(v) => setType((v ?? "suggestion") as FeedbackType)}>
						<SelectTrigger><SelectValue /></SelectTrigger>
						<SelectContent>
							{Object.entries(TYPE_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>{label}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Textarea
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="What's on your mind?"
						rows={5}
					/>
				</div>

				<DialogFooter>
					<Button onClick={handleSubmit} disabled={!message.trim() || submitFeedback.isPending}>
						{submitFeedback.isPending && <Loader2 className="size-4 animate-spin" />}
						Send
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}