// PlatformBilling.ts
import { Schema, model, Types } from "mongoose";
import { SubscriptionPlan } from "../../../shared/types/School";
import { BillingStatus } from "../../../shared/types/School";

export enum PaymentMethod {
    CARD = "CARD",
    BANK_TRANSFER = "BANK_TRANSFER",
    PAYPAL = "PAYPAL"
}

export interface IPlatformBillingDocument {
    Platform: Types.ObjectId;
    plan: SubscriptionPlan;
    amount: number;
    status: BillingStatus;   // ACTIVE, FAILED, PENDING
    paymentMethod: PaymentMethod;
    paidAt?: Date;
    expiresAt?: Date;
    invoiceNumber?: string;
}

const PlatformBillingSchema = new Schema<IPlatformBillingDocument>({
    Platform: { 
        type: Schema.Types.ObjectId, 
        ref: "Platform", 
        required: true 
    },
    plan: { 
        type: String, 
        enum: Object.values(SubscriptionPlan), 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: Object.values(BillingStatus), 
        required: true 
    },
    paymentMethod: { 
        type: String, 
        enum: Object.values(PaymentMethod) 
    },
    paidAt: Date,
    expiresAt: Date,
    invoiceNumber: String
}, { timestamps: true });

export default model<IPlatformBillingDocument>("PlatformBilling", PlatformBillingSchema);
