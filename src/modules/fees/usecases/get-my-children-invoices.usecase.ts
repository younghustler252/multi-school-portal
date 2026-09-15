import { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import { IFeeRepository }      from "../repositories/fee.repository";
import { ForbiddenError }      from "../../../shared/errors/domain.errors";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    feeRepository:      IFeeRepository;
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

    constructor({ guardianRepository, feeRepository }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.feeRepository      = feeRepository;
    }

    async execute(userId: string, params: MyChildInvoicesParams) {
        const childIds = await this.guardianRepository.getChildStudentIds(userId);

        if (params.studentId && !childIds.includes(params.studentId)) {
            throw new ForbiddenError("This student is not linked to your account.");
        }

        const where: Record<string, any> = {
            studentId: params.studentId ?? { in: childIds },
        };
        if (params.termId) where.termId = params.termId;
        if (params.status) where.status = params.status;

        const { page, limit, skip } = parsePagination({ page: params.page ?? 1, limit: params.limit ?? 20 });
        const { data, total } = await this.feeRepository.paginateInvoicesEnriched(where, skip, limit);
        // console.log(data)
        // console.log("childIds", childIds);

        return { data, meta: buildPaginationMeta(total, page, limit) };
    }
}