/*
|--------------------------------------------------------------------------
| JOBS BOOTSTRAP
| Imports all workers so they start listening on startup
|--------------------------------------------------------------------------
*/

export const initWorkers = (): void => {
    require("./workers/provision-schema.worker");
    console.log("✅ Background workers started");
};