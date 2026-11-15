/* REM-074: the legacy aggregate settlement route no longer posts anything; Gateway Settlements is the only settlement write path. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paymentErrors } from "../../src/modules/payments/domain/payment.errors";

const src = (rel: string) => readFileSync(new URL(`../../src/modules/payments/${rel}`, import.meta.url), "utf8");

describe("REM-074: the legacy settlement route", () => {
    it("answers 410 with a pointer to /finance/settlements and posts nothing (no use case is wired to it)", () => {
        const e = paymentErrors.settlementMoved();
        assert.equal(e.statusCode, 410); assert.match(e.message, /\/api\/v1\/finance\/settlements/);
        const routes = readFileSync(new URL("../../src/modules/payments/routes/payment.routes.ts", import.meta.url), "utf8");
        assert.match(routes, /router\.post\("\/online\/settlements", \.\.\.guard\("payments\.settle"\), \(q, _s, n\) => \{[\s\S]*?\[REM-074\][\s\S]*?n\(paymentErrors\.settlementMoved\(\)\);\s*\}\)/);
        assert.ok(!/ctrl\(\)\.settle/.test(routes));
        assert.ok(!/recordSettlementUseCase/.test(readFileSync(new URL("../../src/modules/payments/payments.container.ts", import.meta.url), "utf8")));
        assert.ok(!/recordSettlementUseCase/.test(readFileSync(new URL("../../src/modules/payments/controllers/payment.controller.ts", import.meta.url), "utf8")));
    });
});
