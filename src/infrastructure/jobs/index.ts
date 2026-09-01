

export const initWorkers = (): void => {
    require("./workers/provision-schema.worker");
    require("./workers/notification.worker");
    require("./workers/report-card-generation.worker");

    console.log("✅ Background workers started");
};