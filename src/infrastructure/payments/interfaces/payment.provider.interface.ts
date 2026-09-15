/*
|--------------------------------------------------------------------------
| PAYMENT PROVIDER INTERFACE
| Contract any payment provider (Paystack, Flutterwave) must implement
|--------------------------------------------------------------------------
*/

export interface InitializeTransactionParams {
    email:        string;
    amountKobo:   number;
    reference?:   string;
    callbackUrl?: string;
    subaccount?:  string;       // school's paystack subaccount code
    metadata?:    Record<string, any>;
}

export interface InitializeTransactionResult {
    authorizationUrl: string;
    accessCode:       string;
    reference:        string;
}
export interface VerifyTransactionResult {
    status:            "success" | "failed" | "abandoned";
    reference:         string;
    amountKobo:        number;
    paidAt:            Date | null;
    channel:           string;
    cardLast4?:        string;
    cardBrand?:        string;
    authorizationCode?: string;
    reusable?:          boolean;
    customerEmail:     string;
    metadata?:         Record<string, any>;
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
    customerEmail: string;
    amountKobo:    number;
    authorizationCode: string;
    reference?:    string;
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