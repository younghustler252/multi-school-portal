"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	useCreateSession,
	useCreateTerm,
	useSetCurrentSession,
	useSetCurrentTerm,
} from "@/features/school/hooks/use-sessions";
import {
	createSessionSchema,
	CreateSessionFormValues,
} from "@/features/school/schemas/session.schema";
import { ApiErrorResponse } from "@/types/api-response";

export function SessionTermStep({ onNext }: { onNext: () => void }) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [startYear, setStartYear] = useState("");
	const [endYear, setEndYear] = useState("");
	const [termName, setTermName] = useState<
		"first" | "second" | "third" | ""
	>("");
	const [termStart, setTermStart] = useState("");
	const [termEnd, setTermEnd] = useState("");

	const createSession = useCreateSession();
	const createTerm = useCreateTerm();
	const setCurrentSession = useSetCurrentSession();
	const setCurrentTerm = useSetCurrentTerm();

	const {
		register,
		handleSubmit,
		setValue,
		formState: { errors },
	} = useForm<CreateSessionFormValues>({
		resolver: zodResolver(createSessionSchema),
	});

	const sessionName =
		startYear && endYear ? `${startYear}/${endYear}` : "";

	const yearOptions = useMemo(() => {
		const currentYear = new Date().getFullYear();

		return Array.from({ length: 9 }, (_, i) => currentYear - 3 + i);
	}, []);

	function handleStartYearChange(value: string | null) {
		if (!value) return;

		setStartYear(value);

		const nextYear = String(Number(value) + 1);

		setEndYear(nextYear);
		setValue("name", `${value}/${nextYear}`);
	}

	function handleEndYearChange(value: string | null) {
		if (!value) return;

		setEndYear(value);

		if (startYear) {
			setValue("name", `${startYear}/${value}`);
		}
	}


	async function onSubmit(values: CreateSessionFormValues) {
		if (!startYear || !endYear) {
			toast.error("Please select the academic session");
			return;
		}

		if (Number(endYear) <= Number(startYear)) {
			toast.error("Session end year must be after the start year");
			return;
		}

		if (!termName || !termStart || !termEnd) {
			toast.error("Please fill in the current term details too");
			return;
		}

		if (new Date(termEnd) <= new Date(termStart)) {
			toast.error("Term end date must be after the term start date");
			return;
		}

		setIsSubmitting(true);

		try {
			const session = await createSession.mutateAsync({
				...values,
				name: sessionName,
			});

			await setCurrentSession.mutateAsync(session.id);

			const term = await createTerm.mutateAsync({
				sessionId: session.id,
				name: termName,
				startDate: termStart,
				endDate: termEnd,
			});

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
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<div className="text-center">
				<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
					<CalendarDays className="size-6 text-primary" />
				</div>

				<h1 className="mt-4 text-xl font-semibold tracking-tight">
					Set up your academic session
				</h1>

				<p className="mt-1.5 text-sm text-muted-foreground">
					Tell us which academic year your school is currently
					running and the term you are in.
				</p>
			</div>

			<div className="space-y-1.5">
				<Label>Academic year</Label>

				<div className="grid grid-cols-2 gap-3">
					<Select
						value={startYear}
						onValueChange={handleStartYearChange}
					>
						<SelectTrigger>
							<SelectValue placeholder="Start year" />
						</SelectTrigger>

						<SelectContent>
							{yearOptions.map((year) => (
								<SelectItem
									key={year}
									value={String(year)}
								>
									{year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={endYear}
						onValueChange={handleEndYearChange}
					>
						<SelectTrigger>
							<SelectValue placeholder="End year" />
						</SelectTrigger>

						<SelectContent>
							{yearOptions.map((year) => (
								<SelectItem
									key={year}
									value={String(year)}
								>
									{year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{sessionName && (
					<p className="text-xs text-muted-foreground">
						Session:{" "}
						<span className="font-medium text-foreground">
							{sessionName}
						</span>
					</p>
				)}

				{errors.name && (
					<p className="text-xs text-destructive">
						{errors.name.message}
					</p>
				)}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label htmlFor="startDate">Session start</Label>

					<Input
						id="startDate"
						type="date"
						{...register("startDate")}
					/>

					{errors.startDate && (
						<p className="text-xs text-destructive">
							{errors.startDate.message}
						</p>
					)}
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="endDate">Session end</Label>

					<Input
						id="endDate"
						type="date"
						{...register("endDate")}
					/>

					{errors.endDate && (
						<p className="text-xs text-destructive">
							{errors.endDate.message}
						</p>
					)}
				</div>
			</div>

			<div className="space-y-3 border-t border-border pt-5">
				<div>
					<Label>Current term</Label>

					<p className="mt-0.5 text-xs text-muted-foreground">
						Which term is your school currently in?
					</p>
				</div>

				<Select
					value={termName}
					onValueChange={(value) =>
						setTermName(
							(value ?? "") as typeof termName,
						)
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select current term" />
					</SelectTrigger>

					<SelectContent>
						<SelectItem value="first">
							First Term
						</SelectItem>

						<SelectItem value="second">
							Second Term
						</SelectItem>

						<SelectItem value="third">
							Third Term
						</SelectItem>
					</SelectContent>
				</Select>

				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Term start
						</Label>

						<Input
							type="date"
							value={termStart}
							onChange={(e) =>
								setTermStart(e.target.value)
							}
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">
							Term end
						</Label>

						<Input
							type="date"
							value={termEnd}
							onChange={(e) =>
								setTermEnd(e.target.value)
							}
						/>
					</div>
				</div>
			</div>

			<Button
				type="submit"
				className="w-full"
				size="lg"
				disabled={isSubmitting}
			>
				{isSubmitting && (
					<Loader2 className="size-4 animate-spin" />
				)}
				Continue
			</Button>
		</form>
	);
}
