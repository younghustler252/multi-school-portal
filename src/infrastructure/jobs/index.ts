

export const initWorkers = (): void => {
    require("./workers/provision-schema.worker");
    require("./workers/notification.worker");
    require("./workers/report-card-generation.worker");
    require("./workers/default-reminder.worker");
    require("./workers/subscription-expiry.worker");
    require("./workers/payment-reconciliation.worker")
    require("./workers/ledger-integrity.worker")
    require("./workers/recurring-expenses.worker")
    console.log("✅ Background workers started");
};