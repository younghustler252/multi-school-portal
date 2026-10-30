import { asClass, asFunction, asValue }  from "awilix";
import type { AwilixContainer } from "awilix";
import { prisma }            from "../infrastructure/database/prisma/prisma.client";
import { TenantContext }     from "../infrastructure/database/prisma/tenant.context";
import { MailService }       from "../infrastructure/mail/mail.service";
import { SmsService }        from "../infrastructure/sms/sms.service";
import { ChannelRegistry }   from "../infrastructure/notifications/channel.registry";
import { EmailNotificationChannel } from "../infrastructure/notifications/providers/email.channel";
import { SmsNotificationChannel }   from "../infrastructure/notifications/providers/sms.channel";
import { InAppNotificationChannel } from "../infrastructure/notifications/providers/in-app.channel";
import { SupabaseStorageService } from "../infrastructure/storage/supabase-storage.service";
import { PaystackProvider } from "../infrastructure/payments/paystack.provider";
import { PaystackTransferProvider } from "../infrastructure/payments/paystack-transfer.provider";
import { ManualReviewProvider } from "../infrastructure/verification/provider/manual-review-provider";
import { TokenService } from "../shared/services/token.service";
import { PasswordService } from "../shared/services/password.service";
import { PdfGeneratorService } from "../infrastructure/pdf/pdf-generator.service";
import { EncryptionService } from "../shared/services/encryption.service"

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

        // One delivery road per channel (email, SMS, in-app). WhatsApp has no provider yet, so it is not registered.
        channelRegistry: asFunction(({ mailService, smsService }: { mailService: MailService; smsService: SmsService }) => {
            const registry = new ChannelRegistry();
            registry.register(new EmailNotificationChannel(mailService));
            registry.register(new SmsNotificationChannel(smsService));
            registry.register(new InAppNotificationChannel());
            return registry;
        }).singleton(),

        // ── Storage (uncomment when built) ───────────────────────────────
        storageService: asClass(SupabaseStorageService).singleton(),

        // ── Payments (uncomment when built) ──────────────────────────────
        paymentProvider: asClass(PaystackProvider).singleton(),
        transferProvider: asClass(PaystackTransferProvider).singleton(),

        verificationProvider: asClass(ManualReviewProvider).singleton(),

        // ── Shared Services (uncomment when built) ───────────────────────
        tokenService:    asClass(TokenService).singleton(),
        passwordService: asClass(PasswordService).singleton(),
        encryptionService: asClass(EncryptionService).singleton(),

        pdfGeneratorService: asClass(PdfGeneratorService).singleton()
    });
};