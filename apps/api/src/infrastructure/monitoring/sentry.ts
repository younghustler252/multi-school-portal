import * as Sentry from "@sentry/node";
import { env } from "../../config/env";

export function initSentry(processName: "api" | "worker"): void {
    if (!env.sentryDsn) {
        console.log("⚠️  SENTRY_DSN not set — error tracking disabled");
        return;
    }

    Sentry.init({
        dsn:              env.sentryDsn,
        environment:      env.NODE_ENV,
        tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,
        initialScope:     { tags: { process: processName } },
    });
}

export { Sentry };