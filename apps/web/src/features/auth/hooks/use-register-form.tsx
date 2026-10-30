import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterFormValues } from "../schemas/register.schema";

const STEP_FIELDS: Record<number, (keyof RegisterFormValues)[]> = {
	1: ["schoolName", "subdomain", "schoolEmail", "schoolCategory", "schoolOwnership", "state", "city"],
	2: ["firstName", "lastName", "email", "password", "phone"],
};

export function useRegisterForm() {
	const [step, setStep] = useState(1);

	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		mode: "onTouched",
	});

	async function goNext() {
		const fields = STEP_FIELDS[step];
		const valid = await form.trigger(fields);
		if (valid) setStep((s) => s + 1);
	}

	function goBack() {
		setStep((s) => Math.max(1, s - 1));
	}

	return { step, goNext, goBack, form };
}