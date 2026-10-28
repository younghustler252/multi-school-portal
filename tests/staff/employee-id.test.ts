import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextEmployeeId } from "../../src/modules/staff/services/employee-id";
import { formatEmployeeId } from "../../src/modules/staff/domain/staff.policy";

// A counter that behaves like the real one: it moves only if the transaction is kept.
const makeTx = (taken: string[]) => {
    let counter = 1;
    const seq: any = { next: async () => counter++ };
    const tx: any = { staff: { findUnique: async ({ where }: any) => (taken.includes(where.employeeId) ? { id: "x" } : null) } };
    return { seq, tx, counter: () => counter };
};

describe("next employee id", () => {
    it("gives the next number when it is free", async () => {
        const { seq, tx } = makeTx([]);
        assert.equal(await nextEmployeeId(seq, tx), formatEmployeeId(1));
    });
    it("skips ids someone typed by hand, in the same transaction (the old retry got the same taken id every time)", async () => {
        const { seq, tx, counter } = makeTx([formatEmployeeId(1), formatEmployeeId(2), formatEmployeeId(3)]);
        assert.equal(await nextEmployeeId(seq, tx), formatEmployeeId(4));
        assert.equal(counter(), 5);
    });
    it("gives up with a clear error when 100 numbers in a row are taken", async () => {
        const all = Array.from({ length: 100 }, (_, i) => formatEmployeeId(i + 1));
        const { seq, tx } = makeTx(all);
        await assert.rejects(() => nextEmployeeId(seq, tx), (e: any) => e.code === "EMPLOYEE_ID_FAILED");
    });
});
