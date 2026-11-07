import { describe, expect, it } from "vitest";
import { createRefreshCoordinator, RefreshInProgressError } from "@/lib/api/refresh-coordinator";

const noSleep = () => Promise.resolve();

describe("createRefreshCoordinator", () => {
	it("runs ONE refresh for many simultaneous callers and gives them all the same outcome", async () => {
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const c = createRefreshCoordinator({
			refresh: async () => {
				calls++;
				await gate;
				return true;
			},
			sleep: noSleep,
		});

		const results = [c.refresh(), c.refresh(), c.refresh(), c.refresh()];
		expect(c.isRefreshing()).toBe(true);
		release();

		expect(await Promise.all(results)).toEqual(["refreshed", "refreshed", "refreshed", "refreshed"]);
		expect(calls).toBe(1);
		expect(c.isRefreshing()).toBe(false);
	});

	it("starts a new refresh for a later expiry", async () => {
		let calls = 0;
		const c = createRefreshCoordinator({ refresh: async () => (calls++, true), sleep: noSleep });
		await c.refresh();
		await c.refresh();
		expect(calls).toBe(2);
	});

	it("reports session-ended when the refresh is refused, for every waiter", async () => {
		let calls = 0;
		const c = createRefreshCoordinator({ refresh: async () => (calls++, false), sleep: noSleep });
		expect(await Promise.all([c.refresh(), c.refresh()])).toEqual(["session-ended", "session-ended"]);
		expect(calls).toBe(1);
	});

	it("reports session-ended (and never rejects) when the refresh throws", async () => {
		const c = createRefreshCoordinator({
			refresh: async () => {
				throw new Error("boom");
			},
			sleep: noSleep,
		});
		expect(await c.refresh()).toBe("session-ended");
		expect(c.isRefreshing()).toBe(false);
	});

	it("asks again when another tab holds the rotation (REFRESH_IN_PROGRESS), then succeeds", async () => {
		let calls = 0;
		const waits: number[] = [];
		const c = createRefreshCoordinator({
			refresh: async () => {
				calls++;
				if (calls < 3) throw new RefreshInProgressError();
				return true;
			},
			inProgressDelayMs: 250,
			sleep: async (ms) => void waits.push(ms),
		});
		expect(await c.refresh()).toBe("refreshed");
		expect(calls).toBe(3);
		expect(waits).toEqual([250, 250]);
	});

	it("gives up after the configured attempts when the other tab never finishes", async () => {
		let calls = 0;
		const c = createRefreshCoordinator({
			refresh: async () => {
				calls++;
				throw new RefreshInProgressError();
			},
			inProgressAttempts: 3,
			sleep: noSleep,
		});
		expect(await c.refresh()).toBe("session-ended");
		expect(calls).toBe(3);
	});
});
