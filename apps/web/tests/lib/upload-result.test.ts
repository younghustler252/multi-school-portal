import { describe, expect, it } from "vitest";
import { uploadedUrl } from "@/lib/api/upload-result";
import type { ApiResponse } from "@/types/api-response";

interface Rec { logoUrl: string | null; stamp?: string | null }

describe("uploadedUrl", () => {
	it("takes the address from the field of the returned record", () => {
		const res: ApiResponse<Rec> = { success: true, message: "Logo uploaded successfully", data: { logoUrl: "https://cdn.example.com/a.png" } };
		const out = uploadedUrl(res, (r) => r.logoUrl);
		expect(out.success).toBe(true);
		if (out.success) {
			expect(out.data.url).toBe("https://cdn.example.com/a.png");
			expect(out.message).toBe("Logo uploaded successfully");
		}
	});

	it("passes API failures through untouched", () => {
		const res: ApiResponse<Rec> = { success: false, message: "That image is not valid", code: "INVALID_IMAGE" };
		expect(uploadedUrl(res, (r) => r.logoUrl)).toBe(res);
	});

	it("reports a missing field instead of returning an undefined address", () => {
		const res: ApiResponse<Rec> = { success: true, message: "ok", data: { logoUrl: null } };
		const out = uploadedUrl(res, (r) => r.logoUrl);
		expect(out.success).toBe(false);
	});

	it("picks whichever field the caller names (stamp / signature style)", () => {
		const res: ApiResponse<Rec> = { success: true, message: "ok", data: { logoUrl: null, stamp: "https://cdn.example.com/stamp.png" } };
		const out = uploadedUrl(res, (r) => r.stamp);
		expect(out.success && out.data.url).toBe("https://cdn.example.com/stamp.png");
	});
});
