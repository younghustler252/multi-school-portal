import { ISchoolRepository } from "../repositories/school.repository";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { SchoolMapper, SchoolResponseData } from "../mappers/school.mapper";
import { PaystackProvider } from "../../../infrastructure/payments/paystack.provider";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { PasswordService } from "../../../shared/services/password.service";
import { LoginAttemptService } from "../../auth/services/login-attempt.service";
import { AuthMessageService } from "../../auth/services/auth-message.service";
import { AuditService } from "../../audit/services/audit.service";
import { schoolErrors } from "../domain/school.errors";
import { SetupPaymentDtoType } from "../dtos/school.dto";

interface Dependencies {
    schoolRepository: ISchoolRepository; userRepository: IUserRepository; schoolMapper: SchoolMapper;
    paymentProvider: PaystackProvider; encryptionService: EncryptionService; passwordService: PasswordService;
    loginAttemptService: LoginAttemptService; authMessageService: AuthMessageService; auditService: AuditService;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2);

/*
|--------------------------------------------------------------------------
| SET UP / CHANGE THE PAYMENT (SETTLEMENT) ACCOUNT
| Route guards: school.payments.manage + requireVerifiedSchool.
| Money from parents is paid out to this account, so it is treated as high risk:
|  - the first setup needs no password; CHANGING an existing account needs the user's password
|    (rate limited like a login) so a stolen session cannot redirect school fees
|  - the account number is stored encrypted; only the last 4 digits and the account name are shown
|  - the bank's account name is compared with the school name; a mismatch is allowed but flagged
|    in the audit entry and in the response so platform staff can review it
|  - the school's email and the person's own inbox are told about every change
|--------------------------------------------------------------------------
*/
export class SetupPaymentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(
        schoolId: string, actor: { userId: string; ip: string }, dto: SetupPaymentDtoType,
    ): Promise<SchoolResponseData & { accountNameMatchesSchool: boolean }> {
        const d = this.d;
        const school = await d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();

        const isChange = !!school.paystackSubaccountCode;
        const user = await d.userRepository.findById(actor.userId);
        if (!user) throw schoolErrors.notFound();

        if (isChange) {
            if (!dto.password) throw schoolErrors.passwordRequired();
            await d.loginAttemptService.assertNotBlocked(user.email, actor.ip);
            const full = await d.userRepository.findByEmailWithPassword(user.email);
            if (!full || !(await d.passwordService.compare(dto.password, full.passwordHash))) {
                await d.loginAttemptService.recordFailure(user.email, actor.ip);
                throw schoolErrors.passwordWrong();
            }
            await d.loginAttemptService.clear(user.email, actor.ip);
        }

        let accountName: string;
        try {
            accountName = (await d.paymentProvider.verifyAccountNumber(dto.accountNumber, dto.bankCode)).accountName;
        } catch { throw schoolErrors.bankNotVerified(); }

        const schoolWords = new Set(words(school.name));
        const accountNameMatchesSchool = words(accountName).some(w => schoolWords.has(w));

        const subaccount = await d.paymentProvider.createSubaccount({
            businessName: school.name, bankCode: dto.bankCode, accountNumber: dto.accountNumber,
            percentageCharge: 0,   // the platform takes nothing from school fees
        });

        const updated = await d.schoolRepository.update(schoolId, {
            paystackSubaccountCode:  subaccount.subaccountCode,
            paystackSubaccountId:    subaccount.subaccountCode,
            settlementBankCode:      dto.bankCode,
            settlementAccountNumber: d.encryptionService.encrypt(dto.accountNumber),
            settlementAccountName:   accountName,
            settlementAccountLast4:  dto.accountNumber.slice(-4),
        });

        await d.auditService.log({
            userId: actor.userId, schoolId, action: isChange ? "school.payment_account_changed" : "school.payment_account_set",
            entity: "School", entityId: schoolId,
            oldValue: isChange ? { last4: school.settlementAccountLast4, bankCode: school.settlementBankCode } : undefined,
            newValue: { last4: updated.settlementAccountLast4, bankCode: dto.bankCode, accountName },
            metadata: { accountNameMatchesSchool },
        });

        if (isChange) {
            for (const to of new Set([school.email, user.email])) {
                d.authMessageService.sendEmailSafely("school.payment_account_changed", to, {
                    "school.name": school.name, "account.last4": updated.settlementAccountLast4 ?? "",
                });
            }
        }
        return { ...d.schoolMapper.toResponse(updated), accountNameMatchesSchool };
    }
}
