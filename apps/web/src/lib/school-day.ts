/** Today's calendar day ("YYYY-MM-DD") in the school's time zone. The backend uses Africa/Lagos for "today" (a Nigeria-only v1 rule). */
export function todayInLagos(now: Date = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
