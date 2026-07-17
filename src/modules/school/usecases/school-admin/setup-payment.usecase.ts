import { ISchoolRepository }    from "../../repositories/school.repository";
import { SchoolMapper }         from "../../mappers/school.mapper";
import { SchoolResponseData }   from "../../mappers/school.mapper";
import { PaystackProvider }     from "../../../../infrastructure/payments/paystack.provider";
import {
    NotFoundError,
    BadRequestError,
}                               from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }   from "../../domain/school.enum";
import { SetupPaymentDtoType }  from "../../dtos/school.dto";

/*
|--------------------------------------------------------------------------
| SETUP PAYMENT USE CASE
| School admin sets up their Paystack subaccount for fee collection
| Flow:
| 1. Find school
| 2. Verify bank account number with Paystack
| 3. Create Paystack subaccount
| 4. Save subaccount details to school
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
    paystackProvider:  PaystackProvider;
}

export class SetupPaymentUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;
    private readonly paystackProvider:  PaystackProvider;

    constructor({
        schoolRepository,
        schoolMapper,
        paystackProvider,
    }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
        this.paystackProvider  = paystackProvider;
    }

    async execute(
        schoolId: string,
        dto:      SetupPaymentDtoType,
    ): Promise<SchoolResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Verify account number ─────────────────────────────────────────
        let accountName: string;
        try {
            const verified = await this.paystackProvider.verifyAccountNumber(
                dto.accountNumber,
                dto.bankCode,
            );
            accountName = verified.accountName;
        } catch {
            throw new BadRequestError(
                "Could not verify bank account. Please check account number and bank.",
            );
        }

        // ── Create Paystack subaccount ────────────────────────────────────
        const subaccount = await this.paystackProvider.createSubaccount({
            businessName:     school.name,
            bankCode:         dto.bankCode,
            accountNumber:    dto.accountNumber,
            percentageCharge: 0, // platform takes 0% of school fees
        });

        // ── Save to school ────────────────────────────────────────────────
        const updated = await this.schoolRepository.updatePaystackSubaccount(
            schoolId,
            subaccount.subaccountCode,
            subaccount.subaccountCode,
            dto.bankCode,
            dto.accountNumber,
        );

        return this.schoolMapper.toResponse(updated);
    }
}