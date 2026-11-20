import { ISchoolRepository } from "../repositories/school.repository";
import { PaystackProvider } from "../../../infrastructure/payments/paystack.provider";
import { PaymentProviderError } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { schoolErrors } from "../domain/school.errors";
import { accountNameMatchesSchool } from "../domain/account-name";
import { VerifyBankAccountDtoType } from "../dtos/school.dto";

export interface BankOption { name: string; code: string }
export interface VerifyBankAccountResult { accountName: string; accountNameMatchesSchool: boolean }

type Lookups = Pick<PaystackProvider, "listBanks" | "verifyAccountNumber">;

/* The bank list changes rarely and is the same for every school, so it is kept in memory (per process, not per request) for a day.
   A failed fetch is never cached. */
const BANK_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/* A definite "no" from the bank lookup (bad account or bank) is the same 400 payment-setup gives; anything else
   (timeout, provider down, our key rejected) means we do not know, so the person is told to retry. */
function lookupFailure(e: unknown) {
    if (e instanceof PaymentProviderError && e.definitive && e.httpStatus !== undefined && [400, 404, 422].includes(e.httpStatus)) return schoolErrors.bankNotVerified();
    return schoolErrors.bankLookupUnavailable();
}

/* GET /schools/banks (school.payments.manage, verified school): the banks the payment-setup form can offer. */
let cache: { at: number; banks: BankOption[] } | null = null;
/** For tests: forget the cached list. */
export const resetBankListCache = () => { cache = null; };

export class ListBanksUseCase {
    constructor(private readonly d: { paymentProvider: Lookups }, private readonly now: () => number = Date.now) {}

    async execute(): Promise<BankOption[]> {
        if (cache && this.now() - cache.at < BANK_LIST_TTL_MS) return cache.banks;
        let raw: BankOption[];
        try { raw = await this.d.paymentProvider.listBanks(); } catch (e) { throw lookupFailure(e); }
        const seen = new Set<string>();
        const banks = raw
            .filter(b => b.name && b.code && !seen.has(b.code) && !!seen.add(b.code))
            .map(b => ({ name: b.name, code: b.code }))
            .sort((a, b) => a.name.localeCompare(b.name));
        cache = { at: this.now(), banks };
        return banks;
    }
}

/* POST /schools/payment-setup/verify: previews the account holder's name before the school commits to the account.
   Writes nothing and never returns the account number. */
export class VerifyBankAccountUseCase {
    constructor(private readonly d: { schoolRepository: Pick<ISchoolRepository, "findById">; paymentProvider: Lookups }) {}

    async execute(schoolId: string, dto: VerifyBankAccountDtoType): Promise<VerifyBankAccountResult> {
        const school = await this.d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();
        let accountName: string;
        try { accountName = (await this.d.paymentProvider.verifyAccountNumber(dto.accountNumber, dto.bankCode)).accountName; }
        catch (e) { throw lookupFailure(e); }
        return { accountName, accountNameMatchesSchool: accountNameMatchesSchool(school.name, accountName) };
    }
}
