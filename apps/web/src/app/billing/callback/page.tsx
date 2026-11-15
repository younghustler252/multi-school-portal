import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/*
| The payment provider returns the browser here after checkout, with ?reference=... (and ?trxref=...). Confirming the
| payment is the billing tab's job (it asks the API, never trusting the browser), so this page only forwards there
| and keeps the reference. Signed-out visitors are sent to sign in first by the route guard.
*/
export default async function BillingCallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const params = await searchParams;
	const forward = new URLSearchParams({ tab: "billing" });
	for (const key of ["reference", "trxref"] as const) {
		const value = params[key];
		if (typeof value === "string" && value) forward.set(key, value);
	}
	redirect(`${ROUTES.school.settings}?${forward.toString()}`);
}
