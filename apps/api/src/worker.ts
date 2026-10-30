
// worker.ts (project root)

import "./config/env";

import { initContainer } from "./container";
import { initWorkers } from "./infrastructure/jobs/index";
import { initSentry } from "./infrastructure/monitoring/sentry";
import { initSchedulers } from "./infrastructure/jobs/schedulers";

const startWorker = async (): Promise<void> => {
    initContainer();

    initSentry("worker");

    initWorkers();

    initSchedulers();

    console.log("🔧 Worker process started");
};

startWorker().catch((err) => {
    console.error("❌ Worker process failed to start:", err);
    process.exit(1);
});
