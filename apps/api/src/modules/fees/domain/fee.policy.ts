import { feeErrors } from "./fee.errors";
import { FeeDiscountType } from "./fee.entity";

/* PERCENT is in basis points (1000 = 10%), so it can never be a fraction; FIXED is whole kobo. */
export function assertDiscountValue(type: FeeDiscountType, value: bigint): void {
    if (type === "PERCENT" && (value < 1n || value > 10_000n)) throw feeErrors.discountValueInvalid("A percentage must be between 0.01% and 100%");
    if (type === "FIXED" && value < 1n) throw feeErrors.discountValueInvalid("A fixed discount must be above zero");
}

// Same rule as the database code check: capitals, digits and underscores
export const FEE_TYPE_CODE = /^[A-Z][A-Z0-9_]{1,29}$/;

export function codeFromName(name: string): string {
    return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
}
