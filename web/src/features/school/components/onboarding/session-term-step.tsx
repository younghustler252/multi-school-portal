"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateSession, useCreateTerm, useSetCurrentSession, useSetCurrentTerm } from "@/features/school/hooks/use-sessions";
import { createSessionSchema, CreateSessionFormValues } from "@/features/school/schemas/session.schema";
import { TERM_LABELS } from "../term-badge"; 
import { ApiErrorResponse } from "@/types/api-response";

export function SessionTermStep({ onNext }: { onNext: () => void }) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [termName, setTermName] = useState<"first" | "second" | "third" | "">("");
	const [termStart, setTermStart] = useState("");
	const [termEnd, setTermEnd] = useState("");

	const createSession = useCreateSession();
	const createTerm = useCreateTerm();
	const setCurrentSession = useSetCurrentSession();
	const setCurrentTerm = useSetCurrentTerm();

	const {
		register, handleSubmit, formState: { errors },
	} = useForm<CreateSessionFormValues>({ resolver: zodResolver(createSessionSchema) });

	async function onSubmit(values: CreateSessionFormValues) {
		if (!termName || !termStart || !termEnd) {
			toast.error("Please fill in the current term details too");
			return;
		}
		setIsSubmitting(true);
		try {
			const session = await createSession.mutateAsync(values);
			await setCurrentSession.mutateAsync(session.id);
			const term = await createTerm.mutateAsync({ sessionId: session.id, name: termName, startDate: termStart, endDate: termEnd });
			await setCurrentTerm.mutateAsync(term.id);
			toast.success("Academic session set up");
			onNext();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't set up session");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
			<div>
				<h2 className="text-lg font-semibold">What academic session are you in right now?</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					This doesn&apos;t have to match the current calendar year — enter your school&apos;s actual current session.
				</p>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="name">Session name</Label>
				<Input id="name" {...register("name")} placeholder="e.g. 2026/2027" />
				{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label htmlFor="startDate">Session start</Label>
					<Input id="startDate" type="date" {...register("startDate")} />
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="endDate">Session end</Label>
					<Input id="endDate" type="date" {...register("endDate")} />
				</div>
			</div>

			<div className="border-t border-border pt-4">
				<Label>Current term</Label>
				<Select value={termName} onValueChange={(v) => setTermName((v ?? "") as typeof termName)}>
					<SelectTrigger className="mt-1.5"><SelectValue placeholder="Which term are you in now?" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="first">First Term</SelectItem>
						<SelectItem value="second">Second Term</SelectItem>
						<SelectItem value="third">Third Term</SelectItem>
					</SelectContent>
				</Select>

				<div className="mt-3 grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label>Term start</Label>
						<Input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label>Term end</Label>
						<Input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
					</div>
				</div>
			</div>

			<Button type="submit" className="w-full" disabled={isSubmitting}>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				Continue
			</Button>
		</form>
	);
}