"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TeacherPicker } from "./teacher-picker";
import { classApi } from "../services/class.api";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorResponse } from "@/types/api-response";

export function SetClassTeacherDialog({ classId, open, onOpenChange }: { classId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
	const [teacherId, setTeacherId] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const queryClient = useQueryClient();

	async function handleSave() {
		setIsSubmitting(true);
		try {
			const res = await classApi.setClassTeacher(classId, teacherId || null);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			toast.success("Class teacher updated");
			queryClient.invalidateQueries({ queryKey: ["classes"] });
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't set class teacher");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader><DialogTitle>Set class teacher</DialogTitle></DialogHeader>
				<TeacherPicker value={teacherId} onChange={(id) => setTeacherId(id)} />
				<DialogFooter>
					<Button onClick={handleSave} disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}