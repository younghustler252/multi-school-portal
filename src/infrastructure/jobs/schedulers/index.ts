import { schedulePaymentReconciliation } from "./payment-reconciliation.scheduler";
import { scheduleSubscriptionExpiry } from "./subscription-expiry-scheduler";
import { scheduleDefaulterReminder } from "./defaulter-reminder.scheduler";
import { scheduleLedgerIntegrity } from "../queues/ledger-integrity.queue";

export const initSchedulers = async (): Promise<void> => {
    await schedulePaymentReconciliation();
    await scheduleSubscriptionExpiry();
    await scheduleDefaulterReminder();
    await scheduleLedgerIntegrity();

    console.log("⏰ Job schedulers initialized");
};