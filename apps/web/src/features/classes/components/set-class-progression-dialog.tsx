"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useClasses } from "../hooks/use-classes";
import { useSetClassProgression } from "../hooks/use-classes";
import { ApiErrorResponse } from "@/types/api-response";

interface SetClassProgressionDialogProps {
	classId: string;
	currentToClassId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SetClassProgressionDialog({ classId, currentToClassId, open, onOpenChange }: SetClassProgressionDialogProps) {
	const { data: classes } = useClasses();
	const setProgression = useSetClassProgression();
	const [toClassId, setToClassId] = useState<string | null>(currentToClassId);

	async function handleSave() {
		try {
			await setProgression.mutateAsync({ id: classId, data: { toClassId } });
			toast.success("Promotion target updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update promotion target");
		}
	}

	const otherClasses = classes?.filter((c) => c.id !== classId) ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Promotion target</DialogTitle>
					<DialogDescription>Which class do students in this class move into at promotion time?</DialogDescription>
				</DialogHeader>

				<Select value={toClassId ?? "none"} onValueChange={(v) => setToClassId(v === "none" ? null : v)}>
					<SelectTrigger>
						<SelectValue placeholder="Select a class">
							{(v: string | null) => (!v || v === "none" ? "No promotion (terminal class)" : otherClasses.find((c) => c.id === v)?.name ?? "Select a class")}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No promotion (terminal class)</SelectItem>
						{otherClasses.map((c) => (
							<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
						))}
					</SelectContent>
				</Select>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={handleSave} disabled={setProgression.isPending}>
						{setProgression.isPending && <Loader2 className="size-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}