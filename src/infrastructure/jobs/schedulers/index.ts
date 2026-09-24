import { schedulePaymentReconciliation } from "./payment-reconciliation.scheduler";
import { scheduleSubscriptionExpiry } from "./subscription-expiry-scheduler";
import { scheduleDefaulterReminder } from "./defaulter-reminder.scheduler";

export const initSchedulers = async (): Promise<void> => {
    await schedulePaymentReconciliation();
    await scheduleSubscriptionExpiry();
    await scheduleDefaulterReminder();

    console.log("⏰ Job schedulers initialized");
};