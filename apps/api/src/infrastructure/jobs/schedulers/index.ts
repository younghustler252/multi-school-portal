import { schedulePaymentReconciliation } from "./payment-reconciliation.scheduler";
import { retireSubscriptionExpiry } from "./subscription-expiry-scheduler";
import { scheduleBilling } from "../queues/billing.queue";
import { scheduleSchoolLifecycle } from "../queues/school-lifecycle.queue";
import { scheduleTermLifecycle } from "../queues/term-lifecycle.queue";
import { scheduleAutomationTick } from "../queues/automation.queue";
import { scheduleLedgerIntegrity } from "../queues/ledger-integrity.queue";
import { scheduleRecurringExpenses } from "../queues/recurring-expenses.queue";

export const initSchedulers = async (): Promise<void> => {
    await schedulePaymentReconciliation();
    await retireSubscriptionExpiry();
    await scheduleBilling();
    await scheduleSchoolLifecycle();
    await scheduleTermLifecycle();
    await scheduleAutomationTick();
    await scheduleLedgerIntegrity();
    await scheduleRecurringExpenses();

    console.log("⏰ Job schedulers initialized");
};