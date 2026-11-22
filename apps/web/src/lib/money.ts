/*
|--------------------------------------------------------------------------
| MONEY (kobo)
| The API sends and accepts whole kobo as a safe-integer JSON number, or as a digit string when the value is past 2^53.
| Receipts always carry digit strings. Statement balances can be negative (a negative running balance is credit).
| Every component goes through this file: no `Number(x)`, `+x` or `x / 100` on a money field anywhere else.
|--------------------------------------------------------------------------
*/

/** Money as the API sends it. */
export type Kobo = number | string;

const DIGITS = /^-?\d{1,18}$/;
const REQUEST_DIGITS = /^\d{1,18}$/;

/** A value the API may send for a money field, read exactly; null when it is not whole kobo. */
export function parseKobo(value: unknown): bigint | null {
	if (typeof value === "bigint") return value;
	if (typeof value === "number") return Number.isSafeInteger(value) ? BigInt(value) : null;
	if (typeof value === "string" && DIGITS.test(value)) return BigInt(value);
	return null;
}

/** Like parseKobo, but a bad value is a bug in the contract: say so loudly instead of showing a wrong amount. */
export function toBigInt(value: unknown): bigint {
	const parsed = parseKobo(value);
	if (parsed === null) throw new TypeError(`Not a kobo amount: ${JSON.stringify(value)}`);
	return parsed;
}

/** A bigint back into the API's own form: a number when it is safe, a digit string when it is not. */
export function normalizeKobo(value: bigint): Kobo {
	return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value.toString();
}

/** Add amounts without losing precision. Missing values count as zero. */
export function sumKobo(values: ReadonlyArray<Kobo | null | undefined>): Kobo {
	let total = 0n;
	for (const v of values) if (v !== null && v !== undefined) total += toBigInt(v);
	return normalizeKobo(total);
}

/** -1, 0 or 1. */
export function compareKobo(a: Kobo, b: Kobo): -1 | 0 | 1 {
	const x = toBigInt(a), y = toBigInt(b);
	return x < y ? -1 : x > y ? 1 : 0;
}

export const isPositiveKobo = (v: Kobo | null | undefined): boolean => v !== null && v !== undefined && toBigInt(v) > 0n;
export const isZeroKobo = (v: Kobo | null | undefined): boolean => v === null || v === undefined || toBigInt(v) === 0n;

const GROUPED = new Intl.NumberFormat("en-NG");

/*
| "₦12,500" for whole naira, "₦12,500.50" when there are kobo, "-₦500" below zero.
| Exact for any size: it never turns the amount into a floating-point number.
*/
export function formatKobo(value: Kobo | null | undefined, empty = "—"): string {
	if (value === null || value === undefined) return empty;
	const kobo = toBigInt(value);
	const negative = kobo < 0n;
	const abs = negative ? -kobo : kobo;
	const naira = abs / 100n;
	const rest = abs % 100n;
	const body = `₦${GROUPED.format(naira)}${rest === 0n ? "" : `.${rest.toString().padStart(2, "0")}`}`;
	return negative ? `-${body}` : body;
}

/*
| What a person types ("1,250", "1250.5", "₦1,250.50") as whole kobo, or null when it is not a valid amount.
| At most two decimals; never negative; nothing is rounded.
*/
export function nairaToKobo(input: string): bigint | null {
	const text = input.trim().replace(/^₦/, "").replace(/,/g, "");
	const match = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(text);
	if (!match) return null;
	return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

/** A positive amount in the form the API accepts in a request body (a safe number, else a digit string). */
export function koboForRequest(value: Kobo | bigint): Kobo {
	const kobo = typeof value === "bigint" ? value : toBigInt(value);
	if (kobo <= 0n) throw new RangeError("An amount must be above zero");
	const out = normalizeKobo(kobo);
	if (typeof out === "string" && !REQUEST_DIGITS.test(out)) throw new RangeError("That amount is too large");
	return out;
}
