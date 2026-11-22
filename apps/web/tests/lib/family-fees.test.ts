import { describe, expect, it } from "vitest";
import { balanceOf, childrenOwing, invoicesFor, invoiceTotals, isOpen, isOverdue, statementRange } from "@/features/fees/lib/family-fees";
import type { FamilyChildBalance, FamilyInvoice } from "@/features/fees/types/finance.types";

const inv = (over: Partial<FamilyInvoice>): FamilyInvoice => ({
	id: "i1", invoiceNumber: "INV-2026-000001", student: { id: "s1", name: "Ada" }, status: "unpaid", type: "TERM_FEES",
	issueDate: "2026-09-01", dueDate: "2026-10-01", totalKobo: 100000, paidKobo: 0, balanceKobo: 100000, ...over,
});

describe("invoice filters and totals", () => {
	const list = [inv({ id: "a" }), inv({ id: "b", student: { id: "s2", name: "Ben" }, paidKobo: 50000, balanceKobo: 50000 }), inv({ id: "c", status: "paid", paidKobo: 100000, balanceKobo: 0 })];
	it("filters by child, or keeps all", () => {
		expect(invoicesFor(list, "all").map((i) => i.id)).toEqual(["a", "b", "c"]);
		expect(invoicesFor(list, "s2").map((i) => i.id)).toEqual(["b"]);
	});
	it("totals through exact arithmetic, number and string forms mixed", () => {
		const t = invoiceTotals([inv({ totalKobo: "9007199254740993", balanceKobo: "9007199254740993" }), inv({ totalKobo: 7, balanceKobo: 7 })]);
		expect(t.totalKobo).toBe("9007199254741000");
		expect(t.open).toBe(2);
	});
	it("counts open invoices by balance", () => {
		expect(invoiceTotals(list)).toEqual({ totalKobo: 300000, paidKobo: 150000, balanceKobo: 150000, open: 2 });
		expect(isOpen(list[2])).toBe(false);
	});
});

describe("isOverdue", () => {
	it("is overdue when money is owed and the due date has passed", () => {
		expect(isOverdue(inv({}), "2026-10-02")).toBe(true);
		expect(isOverdue(inv({}), "2026-10-01")).toBe(false);
	});
	it("falls back to the issue date when there is no due date", () => {
		expect(isOverdue(inv({ dueDate: null }), "2026-09-02")).toBe(true);
		expect(isOverdue(inv({ dueDate: null, issueDate: null }), "2030-01-01")).toBe(false);
	});
	it("a cleared invoice is never overdue", () => {
		expect(isOverdue(inv({ balanceKobo: 0 }), "2030-01-01")).toBe(false);
	});
});

describe("children balances", () => {
	const kids: FamilyChildBalance[] = [
		{ studentId: "s1", studentName: "Ada", admissionNumber: null, className: "JSS1", owedKobo: 5000, overdueInvoices: 1, creditKobo: 0 },
		{ studentId: "s2", studentName: "Ben", admissionNumber: null, className: "JSS2", owedKobo: "0", overdueInvoices: 0, creditKobo: 100 },
	];
	it("finds who owes and looks a child up", () => {
		expect(childrenOwing(kids).map((c) => c.studentId)).toEqual(["s1"]);
		expect(balanceOf(kids, "s2")?.creditKobo).toBe(100);
		expect(balanceOf(undefined, "s2")).toBeUndefined();
	});
});

describe("statementRange", () => {
	it("keeps valid days and drops empty ones", () => {
		expect(statementRange("", "")).toEqual({});
		expect(statementRange("2026-09-01", "")).toEqual({ from: "2026-09-01" });
		expect(statementRange("2026-09-01", "2026-10-01")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
	});
	it("refuses a reversed range", () => {
		expect(statementRange("2026-10-01", "2026-09-01")).toBeNull();
	});
});
