import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
| Web unit tests. Same layout as the API: tests live in apps/web/tests/<area>/*.test.ts and import the
| runner explicitly (no globals). The "@" alias mirrors tsconfig.json so tests import code like the app does.
| The default environment is plain Node; a test that needs the DOM opts in with  // @vitest-environment jsdom
| (add jsdom when the first such test is written).
*/
export default defineConfig({
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.{ts,tsx}"],
		restoreMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
	},
});
