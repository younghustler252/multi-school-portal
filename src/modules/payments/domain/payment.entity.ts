export interface PaymentEntity {
    id:               string;
    feeInvoiceId:     string;
    guardianId:       string | null;
    amountKobo:       number;
    method:           string;
    channel:          string | null;
    reference:        string | null;
    status:           string;
    webhookVerified:  boolean;
    providerResponse: any | null;
    receiptUrl:       string | null;
    recordedById:     string | null;
    paidAt:           Date | null;
    createdAt:        Date;
    updatedAt:        Date;
}