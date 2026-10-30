import { schedulePaymentReconciliation } from "./payment-reconciliation.scheduler";
import { scheduleSubscriptionExpiry } from "./subscription-expiry-scheduler";
import { retireDefaulterReminder } from "./defaulter-reminder.scheduler";
import { scheduleAutomationTick } from "../queues/automation.queue";
import { scheduleLedgerIntegrity } from "../queues/ledger-integrity.queue";
import { scheduleRecurringExpenses } from "../queues/recurring-expenses.queue";

export const initSchedulers = async (): Promise<void> => {
    await schedulePaymentReconciliation();
    await scheduleSubscriptionExpiry();
    await retireDefaulterReminder();
    await scheduleAutomationTick();
    await scheduleLedgerIntegrity();
    await scheduleRecurringExpenses();

    console.log("⏰ Job schedulers initialized");
};