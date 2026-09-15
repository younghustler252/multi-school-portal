import { IPaymentRepository } from "../repositories/payment.repository";
import { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import { PaymentMapper }       from "../mappers/payment.mapper";
import { PaymentResponseData } from "../mappers/payment.mapper";
import { PaginatedResult }     from "../../../infrastructure/repository/base.repository";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../../guardians/domain/guardian.enums";

interface Dependencies {
    paymentRepository:  IPaymentRepository;
    guardianRepository: IGuardianRepository;
    paymentMapper:      PaymentMapper;
}

interface MyPaymentsParams {
    page?:  number;
    limit?: number;
}

export class GetMyPaymentsUseCase {
    private readonly paymentRepository:  IPaymentRepository;
    private readonly guardianRepository: IGuardianRepository;
    private readonly paymentMapper:      PaymentMapper;

    constructor({
        paymentRepository,
        guardianRepository,
        paymentMapper,
    }: Dependencies) {
        this.paymentRepository  = paymentRepository;
        this.guardianRepository = guardianRepository;
        this.paymentMapper      = paymentMapper;
    }

    async execute(
        userId: string,
        params: MyPaymentsParams,
    ): Promise<PaginatedResult<PaymentResponseData>> {

        // ─────────────────────────────────────────────────────────────
        // Find guardian belonging to authenticated user
        // ─────────────────────────────────────────────────────────────

        const guardian = await this.guardianRepository.findByUserId(userId);

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        // ─────────────────────────────────────────────────────────────
        // Pagination
        // ─────────────────────────────────────────────────────────────

        const page  = params.page  ?? 1;
        const limit = params.limit ?? 20;

        const where = {
            guardianId: guardian.id,
        };

        // ─────────────────────────────────────────────────────────────
        // Fetch payments
        // ─────────────────────────────────────────────────────────────

        const result = await this.paymentRepository.paginate({
            page,
            limit,
            where,
            orderBy: {
                createdAt: "desc",
            },
        });

        // ─────────────────────────────────────────────────────────────
        // Map payments to response
        // ─────────────────────────────────────────────────────────────

        const mappedPayments = result.data.map((payment) => {
            return this.paymentMapper.toResponse(payment);
        });

        return {
            data: mappedPayments,
            meta: result.meta,
        };
    }
}
