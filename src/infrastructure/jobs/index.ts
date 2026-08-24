/*
|--------------------------------------------------------------------------
| JOBS BOOTSTRAP
| Imports all workers so they start listening on startup
|--------------------------------------------------------------------------
*/

import "./workers/provision-schema.worker";
import "./workers/report-card-generation.worker";

export const initWorkers = (): void => {
	console.log("✅ Background workers started");
};