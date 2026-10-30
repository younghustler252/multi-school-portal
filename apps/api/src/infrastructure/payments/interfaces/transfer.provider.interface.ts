/*
|--------------------------------------------------------------------------
| TRANSFER PROVIDER INTERFACE (money OUT: salary transfers)
| Kept apart from IPaymentProvider (money in) on purpose: this one can move real money.
|
| Every failure is a PaymentProviderError. `definitive` true means the provider said no (nothing was sent);
| false means the outcome is UNKNOWN (timeout, network, 5xx): the caller must check with verifyTransfer and
| must NEVER send the same salary again until the first one is settled one way or the other.
|--------------------------------------------------------------------------
*/
export type TransferState = "success" | "failed" | "reversed" | "pending" | "not_found";

export interface CreateRecipientParams { name: string; accountNumber: string; bankCode: string }
export interface CreateRecipientResult { recipientCode: string }

export interface InitiateTransferParams {
    amountKobo:    number;
    recipientCode: string;
    reference:     string;      // unique per attempt; also what verifyTransfer and the webhook use
    reason?:       string;
}
export interface TransferResult {
    state:         TransferState;
    reference:     string;
    transferCode?: string;
    failureReason?: string;
    message?:      string;      // e.g. the provider is waiting for an OTP
}

export interface ITransferProvider {
    /** False while transfers are switched off for the platform. Nothing is sent then. */
    isEnabled(): boolean;
    createRecipient(params: CreateRecipientParams): Promise<CreateRecipientResult>;
    initiateTransfer(params: InitiateTransferParams): Promise<TransferResult>;
    /** The provider's own record of a transfer, by our reference. `not_found` means the provider never received it. */
    verifyTransfer(reference: string): Promise<TransferResult>;
}
