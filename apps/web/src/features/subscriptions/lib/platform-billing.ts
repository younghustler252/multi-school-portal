import type { ExtendPeriodDto, MarkPaidDto, PlatformPlanChangeDto } from "../types/platform-billing.types";

/*
| Input rules for the platform billing actions (apps/api/src/modules/subscriptions/dtos/subscription.dto.ts).
| Each returns a message for the first problem, or null when the input can be sent.
*/

export const REASON_MIN = 10;
export const REASON_MAX = 300;

export function reasonProblem(reason: string): string | null {
	const n = reason.trim().length;
	if (n < REASON_MIN) return `Give a reason of at least ${REASON_MIN} characters. It is kept in the billing history.`;
	if (n > REASON_MAX) return `Keep the reason under ${REASON_MAX} characters.`;
	return null;
}

export function extendDaysProblem(input: string): string | null {
	if (!/^\d+$/.test(input.trim())) return "Enter a whole number of days.";
	const days = Number(input.trim());
	return days < 1 || days > 90 ? "Extend by 1 to 90 days." : null;
}

/** "YYYY-MM-DD" from a date input; must be after `now`. Empty is fine (the plan's normal period applies). */
export function periodEndProblem(input: string, now: Date = new Date()): string | null {
	if (input === "") return null;
	const t = Date.parse(`${input}T23:59:59.999Z`);
	if (Number.isNaN(t)) return "Enter a valid date.";
	return t <= now.getTime() ? "The end date must be in the future." : null;
}

export function buildPlanChange(v: { planId: string; billingCycle: "monthly" | "yearly"; periodEnd: string; reason: string }): PlatformPlanChangeDto {
	return {
		planId: v.planId,
		billingCycle: v.billingCycle,
		...(v.periodEnd ? { periodEndsAt: `${v.periodEnd}T23:59:59.999Z` } : {}),
		reason: v.reason.trim(),
	};
}

export function buildExtend(days: string, reason: string): ExtendPeriodDto {
	return { days: Number(days.trim()), reason: reason.trim() };
}

export function buildMarkPaid(reference: string, note: string): MarkPaidDto {
	return { reference: reference.trim(), ...(note.trim() ? { note: note.trim() } : {}) };
}

export function markPaidProblem(reference: string, note: string): string | null {
	const r = reference.trim().length;
	if (r < 3 || r > 100) return "Enter the bank transfer reference or receipt number (3 to 100 characters).";
	return note.trim().length > 300 ? "Keep the note under 300 characters." : null;
}
