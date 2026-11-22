import { describe, expect, it } from "vitest";
import { compareKobo, formatKobo, isPositiveKobo, isZeroKobo, koboForRequest, nairaToKobo, normalizeKobo, parseKobo, sumKobo, toBigInt } from "@/lib/money";

const BIG = "9007199254740993"; // 2^53 + 1: not representable as a JS number

describe("parseKobo", () => {
	it("reads safe numbers and digit strings exactly", () => {
		expect(parseKobo(150000)).toBe(150000n);
		expect(parseKobo("150000")).toBe(150000n);
		expect(parseKobo(BIG)).toBe(9007199254740993n);
		expect(parseKobo(-500)).toBe(-500n);
		expect(parseKobo("-500")).toBe(-500n);
	});
	it("refuses anything that is not whole kobo", () => {
		for (const bad of [1.5, NaN, Infinity, 2 ** 60, "12.50", "1e3", " 12", "", "abc", null, undefined, {}, "1234567890123456789"]) {
			expect(parseKobo(bad)).toBeNull();
		}
	});
	it("toBigInt throws on a bad value instead of guessing", () => {
		expect(() => toBigInt("12.5")).toThrow(TypeError);
		expect(toBigInt("0")).toBe(0n);
	});
});

describe("normalizeKobo", () => {
	it("returns a number when safe and a digit string when not", () => {
		expect(normalizeKobo(1000n)).toBe(1000);
		expect(normalizeKobo(-1000n)).toBe(-1000);
		expect(normalizeKobo(9007199254740993n)).toBe(BIG);
	});
});

describe("sumKobo", () => {
	it("adds numbers and strings without losing precision", () => {
		expect(sumKobo([100, "250", 50])).toBe(400);
		expect(sumKobo([BIG, 1])).toBe("9007199254740994");
		expect(sumKobo([])).toBe(0);
	});
	it("treats missing values as zero and keeps negatives", () => {
		expect(sumKobo([null, undefined, 300, -100])).toBe(200);
	});
});

describe("compare and sign helpers", () => {
	it("compares across number and string forms", () => {
		expect(compareKobo(100, "100")).toBe(0);
		expect(compareKobo(BIG, 5)).toBe(1);
		expect(compareKobo(-1, 0)).toBe(-1);
	});
	it("isPositiveKobo / isZeroKobo", () => {
		expect(isPositiveKobo("1")).toBe(true);
		expect(isPositiveKobo(0)).toBe(false);
		expect(isPositiveKobo(null)).toBe(false);
		expect(isZeroKobo(null)).toBe(true);
		expect(isZeroKobo("0")).toBe(true);
		expect(isZeroKobo(5)).toBe(false);
	});
});

describe("formatKobo", () => {
	it("shows whole naira without decimals and kobo when present", () => {
		expect(formatKobo(1250000)).toBe("₦12,500");
		expect(formatKobo(1250050)).toBe("₦12,500.50");
		expect(formatKobo(5)).toBe("₦0.05");
		expect(formatKobo(0)).toBe("₦0");
	});
	it("shows credit (negative) clearly", () => {
		expect(formatKobo(-50000)).toBe("-₦500");
		expect(formatKobo("-50050")).toBe("-₦500.50");
	});
	it("is exact for values past 2^53", () => {
		expect(formatKobo(BIG)).toBe("₦90,071,992,547,409.93");
	});
	it("shows a placeholder for a missing value", () => {
		expect(formatKobo(null)).toBe("—");
		expect(formatKobo(undefined, "n/a")).toBe("n/a");
	});
	it("throws on a malformed amount rather than printing a wrong one", () => {
		expect(() => formatKobo("12.5")).toThrow(TypeError);
	});
});

describe("nairaToKobo", () => {
	it("reads what a person types", () => {
		expect(nairaToKobo("1,250")).toBe(125000n);
		expect(nairaToKobo("₦1,250.5")).toBe(125050n);
		expect(nairaToKobo("0.05")).toBe(5n);
		expect(nairaToKobo(" 100 ")).toBe(10000n);
	});
	it("refuses what is not an amount", () => {
		for (const bad of ["", "-5", "1.234", "abc", "1.", ".5", "1e3", "12 000"]) expect(nairaToKobo(bad)).toBeNull();
	});
});

describe("koboForRequest", () => {
	it("keeps safe numbers as numbers and large values as digit strings", () => {
		expect(koboForRequest(5000)).toBe(5000);
		expect(koboForRequest(10n ** 17n)).toBe("100000000000000000");
		expect(koboForRequest("250")).toBe(250);
	});
	it("refuses zero, negatives and amounts the API would reject", () => {
		expect(() => koboForRequest(0)).toThrow(RangeError);
		expect(() => koboForRequest(-1)).toThrow(RangeError);
		expect(() => koboForRequest(10n ** 18n)).toThrow(RangeError);
	});
});
