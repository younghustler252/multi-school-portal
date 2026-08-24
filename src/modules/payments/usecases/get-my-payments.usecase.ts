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

        console.log("\n========== GET MY PAYMENTS ==========");
        console.log("[GetMyPayments] userId:", userId);
        console.log("[GetMyPayments] params:", params);

        // ─────────────────────────────────────────────────────────────
        // Find guardian belonging to authenticated user
        // ─────────────────────────────────────────────────────────────
        console.log("[GetMyPayments] Looking up guardian...");

        const guardian = await this.guardianRepository.findByUserId(userId);

        console.log(
            "[GetMyPayments] Guardian found:",
            guardian
                ? {
                    id: guardian.id,
                    userId: guardian.userId,
                }
                : null,
        );

        if (!guardian) {
            console.log(
                "[GetMyPayments] ❌ No guardian found for userId:",
                userId,
            );

            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        console.log(
            "[GetMyPayments] Guardian ID being used for payment query:",
            guardian.id,
        );

        // ─────────────────────────────────────────────────────────────
        // Pagination
        // ─────────────────────────────────────────────────────────────
        const page  = params.page  ?? 1;
        const limit = params.limit ?? 20;

        console.log("[GetMyPayments] Pagination:", {
            page,
            limit,
        });

        const where = {
            guardianId: guardian.id,
        };

        console.log(
            "[GetMyPayments] Payment query WHERE:",
            where,
        );

        // ─────────────────────────────────────────────────────────────
        // Fetch payments
        // ─────────────────────────────────────────────────────────────
        console.log("[GetMyPayments] Fetching payments...");

        const result = await this.paymentRepository.paginate({
            page,
            limit,
            where,
            orderBy: {
                createdAt: "desc",
            },
        });

        console.log("[GetMyPayments] Repository result:", {
            count: result.data?.length ?? 0,
            meta: result.meta,
        });

        console.log(
            "[GetMyPayments] Raw payments:",
            result.data,
        );

        // ─────────────────────────────────────────────────────────────
        // Map payments to response
        // ─────────────────────────────────────────────────────────────
        console.log("[GetMyPayments] Mapping payments...");

        const mappedPayments = result.data.map((payment) => {
            console.log(
                "[GetMyPayments] Mapping payment:",
                payment,
            );

            return this.paymentMapper.toResponse(payment);
        });

        console.log(
            "[GetMyPayments] Mapped payments count:",
            mappedPayments.length,
        );

        console.log(
            "[GetMyPayments] Final response:",
            {
                data: mappedPayments,
                meta: result.meta,
            },
        );

        console.log("========== END GET MY PAYMENTS ==========\n");

        return {
            data: mappedPayments,
            meta: result.meta,
        };
    }
}
