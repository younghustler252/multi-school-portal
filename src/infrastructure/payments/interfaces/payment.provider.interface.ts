/*
|--------------------------------------------------------------------------
| PAYMENT PROVIDER INTERFACE
| Contract any payment provider (Paystack, Flutterwave) must implement.
| Changes in this version: verify results now carry what saving a card needs (authorization code,
| signature, expiry), the currency and the provider's own message; status can be "pending"; charges and
| initializations accept a currency; and failures are reported as PaymentProviderError so callers can tell
| a DEFINITE failure from an unknown outcome (a timeout must never be treated as "not charged").
|--------------------------------------------------------------------------
*/

export class PaymentProviderError extends Error {
    constructor(message: string, public readonly definitive: boolean, public readonly httpStatus?: number) {
        super(message);
        this.name = "PaymentProviderError";
    }
}

export interface InitializeTransactionParams {
    email:        string;
    amountKobo:   number;
    reference?:   string;
    callbackUrl?: string;
    subaccount?:  string;       // school's paystack subaccount code
    currency?:    string;       // default NGN
    channels?:    string[];     // e.g. ["card"] to force a card payment
    metadata?:    Record<string, any>;
}

export interface InitializeTransactionResult {
    authorizationUrl: string;
    accessCode:       string;
    reference:        string;
}

export interface VerifyTransactionResult {
    status:             "success" | "failed" | "abandoned" | "pending";
    reference:          string;
    amountKobo:         number;
    currency?:          string;
    paidAt:             Date | null;
    channel:            string;
    cardLast4?:         string;
    cardBrand?:         string;
    cardExpMonth?:      number;
    cardExpYear?:       number;
    cardBank?:          string;
    authorizationCode?: string;
    authorizationSignature?: string;
    reusable?:          boolean;
    customerEmail:      string;
    customerCode?:      string;
    gatewayResponse?:   string;
    metadata?:          Record<string, any>;
}

export interface CreateSubaccountParams {
    businessName:        string;
    bankCode:             string;
    accountNumber:        string;
    percentageCharge:     number;   // platform's cut, e.g. 2 = 2%
}

export interface CreateSubaccountResult {
    subaccountCode: string;
    accountName:    string;
}

export interface CreateRecurringChargeParams {
    customerEmail:     string;      // MUST be the email used when the card was saved
    amountKobo:        number;
    authorizationCode: string;
    reference?:        string;      // pass a deterministic reference so a retry can never charge twice
    currency?:         string;
    metadata?:         Record<string, any>;
}

export interface IPaymentProvider {
    initializeTransaction(params: InitializeTransactionParams): Promise<InitializeTransactionResult>;
    verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
    createSubaccount(params: CreateSubaccountParams): Promise<CreateSubaccountResult>;
    chargeAuthorization(params: CreateRecurringChargeParams): Promise<VerifyTransactionResult>;
    listBanks(): Promise<Array<{ name: string; code: string }>>;
    verifyAccountNumber(accountNumber: string, bankCode: string): Promise<{ accountName: string }>;
    verifyWebhookSignature(payload: string, signature: string): boolean;
}
