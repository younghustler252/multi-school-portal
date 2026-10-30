export function formatNaira(kobo: number): string {
	const naira = kobo / 100;
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 0,
	}).format(naira);
}