// worker.ts (project root)
import "./config/env";
import { initContainer } from "./container";
import { initWorkers } from "./infrastructure/jobs/index";
import { initSentry } from "./infrastructure/monitoring/sentry";

initContainer();
initSentry("worker");
initWorkers();
console.log("🔧 Worker process started");