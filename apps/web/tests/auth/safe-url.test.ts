import { describe, expect, it } from "vitest";
import { isSafeSchoolUrl } from "@/lib/auth/safe-url";

describe("isSafeSchoolUrl", () => {
	it("accepts http and https school addresses, including a development subdomain", () => {
		expect(isSafeSchoolUrl("https://greenfield.schoolos.app")).toBe(true);
		expect(isSafeSchoolUrl("https://portal.greenfield.edu.ng")).toBe(true);
		expect(isSafeSchoolUrl("http://greenfield.localhost:3000")).toBe(true);
	});

	it("rejects anything that is not a plain http(s) URL", () => {
		expect(isSafeSchoolUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeSchoolUrl("data:text/html,<script>1</script>")).toBe(false);
		expect(isSafeSchoolUrl("//evil.test")).toBe(false);
		expect(isSafeSchoolUrl("/relative/path")).toBe(false);
		expect(isSafeSchoolUrl("greenfield")).toBe(false);
		expect(isSafeSchoolUrl("")).toBe(false);
		expect(isSafeSchoolUrl(undefined)).toBe(false);
		expect(isSafeSchoolUrl(null)).toBe(false);
	});
});
