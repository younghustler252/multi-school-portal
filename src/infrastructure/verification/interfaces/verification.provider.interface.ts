// infrastructure/verification/interfaces/verification.provider.interface.ts
export interface VerifyDocumentParams {
    idType:      string;    // "nin" | "voters_card" | "drivers_license" | "international_passport"
    idNumber:    string;
    fullName:    string;
}

export interface VerifyDocumentResult {
    verified:      boolean;
    matchedName?:  string;
    rawResponse:   Record<string, any>;
}

export interface IDocumentVerificationProvider {
    verifyGovernmentId(params: VerifyDocumentParams): Promise<VerifyDocumentResult>;
}