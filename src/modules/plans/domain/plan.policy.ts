import { planErrors } from "./plan.errors";

// A paid plan must have both prices; a free plan has neither; yearly can never cost more than twelve months
export function assertPrices(monthly: number, yearly: number): void {
    if (monthly === 0 && yearly !== 0) throw planErrors.badPrice("A plan with a free monthly price must have a free yearly price too");
    if (monthly > 0 && yearly === 0)   throw planErrors.badPrice("Set a yearly price (it cannot be free when the monthly price is not)");
    if (yearly > monthly * 12)         throw planErrors.badPrice("The yearly price cannot be higher than twelve monthly payments");
}
