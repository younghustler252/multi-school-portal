import { PlanEntity } from "../../plans/domain/plan.entity";
import { SubscriptionEntity } from "../domain/subscription.entity";
import { Cycle, addCycle, priceFor, remainingFraction } from "../domain/billing.calendar";
import { CouponRow, CouponService } from "./coupon.service";

export interface QuoteItem { kind: "plan" | "setup_fee" | "proration_credit" | "discount" | "adjustment"; description: string; amountKobo: number }

export interface Quote {
    items:        QuoteItem[];
    subtotalKobo: number;
    discountKobo: number;
    totalKobo:    number;
    periodStart:  Date;
    periodEnd:    Date;
    keepsPeriod:  boolean;      // true: same renewal date as now (price difference only); false: a new period starts today
    couponId:     string | null;
}

/*
|--------------------------------------------------------------------------
| PRORATION (what an upgrade costs). Pure calculation, no database.
|  - Inside a paid period, same cycle, higher price: keep the renewal date and charge the PRICE DIFFERENCE
|    for the days that are left (new plan's share of the remaining time minus the unused share of the old one).
|  - Anything else (coming from Free or a trial, or switching monthly <-> yearly): a NEW period starts today at
|    the full price, minus a credit for the unused part of the old paid period.
|  - A one-time setup fee is charged only for what was not already paid (moving between plans never pays it twice).
|  - A coupon discounts the plan charge only. A credit larger than the charge is not refunded or carried over.
| Amounts are whole kobo; the items always add up to the total.
|--------------------------------------------------------------------------
*/
export class ProrationService {
    private readonly coupons: CouponService;
    constructor({ couponService }: { couponService: CouponService }) { this.coupons = couponService; }

    quote(input: {
        sub: SubscriptionEntity; currentPlan: PlanEntity; newPlan: PlanEntity; cycle: Cycle; now: Date;
        coupon: CouponRow | null; setupAlreadyPaidKobo: number;
    }): Quote {
        const { sub, currentPlan, newPlan, cycle, now, coupon, setupAlreadyPaidKobo } = input;

        const oldPrice  = sub.status === "trialing" ? 0 : priceFor(currentPlan, sub.billingCycle);
        const newPrice  = priceFor(newPlan, cycle);
        const live      = oldPrice > 0 && sub.currentPeriodEnd > now;
        const frac      = live ? remainingFraction(sub.currentPeriodStart, sub.currentPeriodEnd, now) : 0;
        const keeps     = live && cycle === sub.billingCycle && newPrice > oldPrice;

        const items: QuoteItem[] = [];
        let periodStart: Date, periodEnd: Date, planCharge: number;

        if (keeps) {
            planCharge  = Math.round(newPrice * frac);
            periodStart = sub.currentPeriodStart;
            periodEnd   = sub.currentPeriodEnd;
            items.push({ kind: "plan", description: `${newPlan.name} (${cycle}), remaining days of this period`, amountKobo: planCharge });
        } else {
            planCharge  = newPrice;
            periodStart = now;
            periodEnd   = addCycle(now, cycle, now.getUTCDate());
            items.push({ kind: "plan", description: `${newPlan.name} (${cycle})`, amountKobo: planCharge });
        }

        const credit = live ? Math.round(oldPrice * frac) : 0;
        if (credit > 0) items.push({ kind: "proration_credit", description: `Unused time on ${currentPlan.name}`, amountKobo: -credit });

        const setup = Math.max(0, newPlan.setupFeeKobo - setupAlreadyPaidKobo);
        if (setup > 0) items.push({ kind: "setup_fee", description: "One-time setup fee", amountKobo: setup });

        const discount = coupon ? this.coupons.discountFor(coupon, planCharge) : 0;
        if (discount > 0) items.push({ kind: "discount", description: `Coupon ${coupon!.code}`, amountKobo: -discount });

        const subtotal = planCharge - credit + setup;
        let total = subtotal - discount;
        if (total < 0) {
            items.push({ kind: "adjustment", description: "Credit beyond the amount due (not refundable)", amountKobo: -total });
            total = 0;
        }
        return { items, subtotalKobo: subtotal, discountKobo: discount, totalKobo: total, periodStart, periodEnd, keepsPeriod: keeps, couponId: coupon?.id ?? null };
    }
}
