import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SubmitFeedbackUseCase } from "../../src/modules/feedback/usecases/submit-feedback.usecase";

const dto: any = { type: "bug", message: "Button does not work", pageUrl: "/fees" };

function build(supportEmail: string, mail: { sendLetter: (to: string, l: any) => Promise<void> }) {
    const saved: any[] = [];
    const uc = new SubmitFeedbackUseCase({
        feedbackRepository: { create: async (d: any) => { saved.push(d); return { id: "f1", ...d }; } } as any,
        mailService: mail as any,
        platformSettingsRepository: { find: async () => ({ supportEmail }) } as any,
    });
    return { uc, saved };
}

describe("submit feedback", () => {
    it("emails the support address from Platform settings, not a fixed one", async () => {
        const sent: string[] = [];
        const { uc, saved } = build("help@myplatform.ng", { sendLetter: async (to) => { sent.push(to); } });
        await uc.execute(dto, "u1", "s1");
        assert.deepEqual(sent, ["help@myplatform.ng"]); assert.equal(saved.length, 1);
    });
    it("an empty support email means nobody is emailed, and the feedback is still saved", async () => {
        const sent: string[] = [];
        const { uc, saved } = build("  ", { sendLetter: async (to) => { sent.push(to); } });
        const out = await uc.execute(dto, null, null);
        assert.equal(sent.length, 0); assert.equal(saved.length, 1); assert.equal(out.id, "f1");
    });
    it("a failing email never fails the submission", async () => {
        const { uc } = build("help@myplatform.ng", { sendLetter: async () => { throw new Error("smtp down"); } });
        const orig = console.error; console.error = () => {};
        try { assert.equal((await uc.execute(dto, "u1", "s1")).id, "f1"); } finally { console.error = orig; }
    });
});
