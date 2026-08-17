import { IGuardianRepository }    from "../../guardians/repositories/guardian.repository";
import { IFeeRepository }         from "../repositories/fee.repository";
import { FeeInvoiceMapper }       from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ForbiddenError }         from "../../../shared/errors/domain.errors";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    feeRepository:      IFeeRepository;
    feeInvoiceMapper:   FeeInvoiceMapper;
}

interface MyChildInvoicesParams {
    studentId?: string;
    termId?:    string;
    status?:    string;
    page?:      number;
    limit?:     number;
}

export class GetMyChildrenInvoicesUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly feeRepository:      IFeeRepository;
    private readonly feeInvoiceMapper:   FeeInvoiceMapper;

    constructor({ guardianRepository, feeRepository, feeInvoiceMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.feeRepository      = feeRepository;
        this.feeInvoiceMapper   = feeInvoiceMapper;
    }

    async execute(
        userId: string,
        params: MyChildInvoicesParams,
    ): Promise<PaginatedResult<FeeInvoiceResponseData>> {
        const childIds = await this.guardianRepository.getChildStudentIds(userId);

        if (params.studentId && !childIds.includes(params.studentId)) {
            throw new ForbiddenError("This student is not linked to your account.");
        }

        const where: Record<string, any> = {
            studentId: params.studentId ?? { in: childIds },
        };
        if (params.termId) where.termId = params.termId;
        if (params.status) where.status = params.status;

        const result = await this.feeRepository.paginateInvoices({
            page:    params.page  ?? 1,
            limit:   params.limit ?? 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(i => this.feeInvoiceMapper.toResponse(i)),
            meta: result.meta,
        };
    }
}