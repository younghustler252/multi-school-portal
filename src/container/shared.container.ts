import { asClass, asValue }  from "awilix";
import type { AwilixContainer } from "awilix";
import { prisma }            from "../infrastructure/database/prisma/prisma.client";
import { TenantContext }     from "../infrastructure/database/prisma/tenant.context";
import { MailService }       from "../infrastructure/mail/mail.service";
import { SmsService }        from "../infrastructure/sms/sms.service";
import { SupabaseStorageService } from "../infrastructure/storage/supabase-storage.service";
import { PaystackProvider } from "../infrastructure/payments/paystack.provider";
import { ManualReviewProvider } from "../infrastructure/verification/provider/manual-review-provider";
import { TokenService } from "../shared/services/token.service";
import { PasswordService } from "../shared/services/password.service";
import { PdfGeneratorService } from "../infrastructure/pdf/pdf-generator.service";

/*
|--------------------------------------------------------------------------
| SHARED CONTAINER
| Registers all shared infrastructure services
| These are singletons available to every module
|--------------------------------------------------------------------------
*/

export const registerShared = (container: AwilixContainer): void => {
    container.register({

        // ── Database ─────────────────────────────────────────────────────
        prismaClient:  asValue(prisma),
        tenantContext: asValue(TenantContext),

        // ── Communication ────────────────────────────────────────────────
        mailService:   asClass(MailService).singleton(),
        smsService:    asClass(SmsService).singleton(),

        // ── Storage (uncomment when built) ───────────────────────────────
        storageService: asClass(SupabaseStorageService).singleton(),

        // ── Payments (uncomment when built) ──────────────────────────────
        paymentProvider: asClass(PaystackProvider).singleton(),

        verificationProvider: asClass(ManualReviewProvider).singleton(),

        // ── Shared Services (uncomment when built) ───────────────────────
        tokenService:    asClass(TokenService).singleton(),
        passwordService: asClass(PasswordService).singleton(),

        pdfGeneratorService: asClass(PdfGeneratorService).singleton()
    });
};