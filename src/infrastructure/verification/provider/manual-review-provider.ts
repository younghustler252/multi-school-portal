// infrastructure/verification/manual-review.provider.ts
// Fallback: always defers to a human — used when no real API is wired up yet,
// or when a real provider's call fails/times out.
import { IDocumentVerificationProvider, VerifyDocumentParams, VerifyDocumentResult } from "../interfaces/verification.provider.interface";

export class ManualReviewProvider implements IDocumentVerificationProvider {
    async verifyGovernmentId(_params: VerifyDocumentParams): Promise<VerifyDocumentResult> {
        return { verified: false, rawResponse: { note: "Routed to manual review — no automated check performed." } };
    }
}