/* Money in API responses: whole kobo, as a JSON number when it is safe and a digit string when it is not. */
export const koboOut = (v: bigint): number | string =>
    v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v.toString();

export const dayOut = (d: Date): string => d.toISOString().slice(0, 10);
