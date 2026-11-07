/*
| Single-flight token refresh (API-002).
| Many requests can hit TOKEN_EXPIRED at the same moment. Exactly one refresh runs; everyone else waits for it and then
| retries once. If the refresh fails, every waiter fails together and the caller ends the session once.
| Free of axios and React so it can be tested on its own.
*/

export type RefreshOutcome = "refreshed" | "session-ended";

export interface RefreshCoordinatorOptions {
	/** Performs the refresh call. Resolve true when new cookies were issued. May throw. */
	refresh: () => Promise<boolean>;
	/** Wait between attempts when the server answers REFRESH_IN_PROGRESS (another tab is rotating the token). */
	inProgressDelayMs?: number;
	inProgressAttempts?: number;
	sleep?: (ms: number) => Promise<void>;
}

/** Thrown by `refresh` when the server says another refresh holds the token right now. */
export class RefreshInProgressError extends Error {
	constructor() {
		super("Refresh already in progress");
		this.name = "RefreshInProgressError";
	}
}

export function createRefreshCoordinator(options: RefreshCoordinatorOptions) {
	const delay = options.inProgressDelayMs ?? 400;
	const attempts = options.inProgressAttempts ?? 3;
	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
	let inflight: Promise<RefreshOutcome> | null = null;

	async function run(): Promise<RefreshOutcome> {
		for (let i = 0; i < attempts; i++) {
			try {
				return (await options.refresh()) ? "refreshed" : "session-ended";
			} catch (err) {
				// Another tab holds the rotation; its new cookies will be ours too, so ask again shortly.
				if (err instanceof RefreshInProgressError && i < attempts - 1) {
					await sleep(delay);
					continue;
				}
				return "session-ended";
			}
		}
		return "session-ended";
	}

	return {
		/** Join the refresh in flight, or start one. Never rejects. */
		refresh(): Promise<RefreshOutcome> {
			if (!inflight) {
				inflight = run().finally(() => {
					inflight = null;
				});
			}
			return inflight;
		},
		isRefreshing: () => inflight !== null,
	};
}

export type RefreshCoordinator = ReturnType<typeof createRefreshCoordinator>;
