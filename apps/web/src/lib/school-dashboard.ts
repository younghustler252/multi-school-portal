import type { SchoolDashboardData } from "@/features/school/types/school.types";

/*
| Numbers and wording derived from GET /school/dashboard. Pure: no React, no browser APIs, the clock is passed in. Keeping
| this out of the page means the rules are tested once and any client can reuse them.
| Nothing here invents data: every function only rearranges what the API sent.
*/

type Attendance = NonNullable<SchoolDashboardData["attendance"]>;
type Fees = NonNullable<SchoolDashboardData["fees"]>;

const percent = (part: number, whole: number): number | null =>
	whole > 0 ? Math.round((part / whole) * 100) : null;

// ── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceView {
	/** Everyone with any mark today (present + late + absent + excused). Zero means nothing has been marked yet. */
	marked: number;
	/** Present or late: they came to school. */
	attended: number;
	/** Present + late + absent. Excused is left out: an excused absence is not held against attendance. */
	counted: number;
	excused: number;
	/** attended / counted, whole percent. null when counted is 0 (nothing marked, or everyone excused): never a fake 0%. */
	ratePercent: number | null;
	/** Excused stays in the breakdown even though it is not in the rate. */
	segments: { key: "present" | "late" | "absent" | "excused"; label: string; count: number }[];
}

export function attendanceView(a: Attendance): AttendanceView {
	const attended = a.present + a.late;
	const counted = attended + a.absent;
	return {
		marked: counted + a.excused,
		attended,
		counted,
		excused: a.excused,
		ratePercent: percent(attended, counted),
		segments: [
			{ key: "present", label: "Present", count: a.present },
			{ key: "late", label: "Late", count: a.late },
			{ key: "absent", label: "Absent", count: a.absent },
			{ key: "excused", label: "Excused", count: a.excused },
		],
	};
}

/**
 * Plain-words label for which attendance the figures cover (the viewer's attendance.view scope).
 * Returns null when the API did not say or sent something unrecognised: then the UI says nothing about coverage
 * rather than guessing "whole school".
 */
export function attendanceScopeLabel(scope: string | undefined): string | null {
	switch (scope) {
		case "ALL": return "Whole school";
		case "BRANCH": return "Your branches";
		case "ASSIGNED": return "Your classes";
		case "OWN": return "Your own records";
		default: return null;
	}
}

// ── Fees ─────────────────────────────────────────────────────────────────────

export interface FeesView {
	/** collected / invoiced, whole percent. null when nothing has been invoiced this term. */
	collectedPercent: number | null;
	hasInvoices: boolean;
}

export function feesView(f: Fees): FeesView {
	return {
		collectedPercent: percent(f.totalCollectedKobo, f.totalInvoicedKobo),
		hasInvoices: f.totalInvoicedKobo > 0,
	};
}

// ── Plan limits ──────────────────────────────────────────────────────────────

export interface UsageView {
	used: number;
	/** null = the plan has no limit. */
	limit: number | null;
	/** used / limit, capped at 100. null when unlimited. */
	percent: number | null;
	state: "unlimited" | "ok" | "near" | "full";
}

/** `near` from 90% of the limit, `full` at or above it. */
export function usageView(used: number, limit: number | null): UsageView {
	if (limit === null) return { used, limit, percent: null, state: "unlimited" };
	// A limit of 0 means the plan includes none, so there is no room at all.
	if (limit <= 0) return { used, limit, percent: 100, state: "full" };
	const raw = (used / limit) * 100;
	return {
		used,
		limit,
		percent: Math.min(100, Math.round(raw)),
		state: raw >= 100 ? "full" : raw >= 90 ? "near" : "ok",
	};
}

export interface PlanExpiryView {
	state: "none" | "ok" | "soon" | "expired";
	/** Whole days from `now` to the end date; negative once passed. null when there is no end date. */
	daysLeft: number | null;
}

/** `soon` = 14 days or fewer left. */
export function planExpiryView(expiresAt: string | null, now: Date): PlanExpiryView {
	if (!expiresAt) return { state: "none", daysLeft: null };
	const end = new Date(expiresAt).getTime();
	if (Number.isNaN(end)) return { state: "none", daysLeft: null };
	const daysLeft = Math.ceil((end - now.getTime()) / 86_400_000);
	return { state: daysLeft < 0 ? "expired" : daysLeft <= 14 ? "soon" : "ok", daysLeft };
}

// ── Which sections the viewer received ───────────────────────────────────────

/**
 * True when the API sent none of the sections the dashboard actually draws (people, fees, attendance), so the page can
 * say so instead of showing an empty grid. `academics` is deliberately not counted: it only feeds the subtitle (the
 * current term), so counting it would hide the empty state from someone who sees no figures. If a section is added to
 * the page, add it here.
 */
export function hasNothingToShow(d: SchoolDashboardData): boolean {
	return !d.people && !d.fees && !d.attendance;
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** "Sat 21 Nov" for the API's calendar day (YYYY-MM-DD). Read as UTC so the day never shifts with the viewer's zone. */
export function formatSchoolDay(day: string): string {
	const date = new Date(`${day}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return day;
	return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}
