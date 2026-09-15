import { IAuditRepository } from "../repositories/audit.repository";

interface Dependencies { auditRepository: IAuditRepository; }

interface MyOrgActivityParams {
    page?:  number;
    limit?: number;
}

export class GetMyOrgActivityUseCase {
    private readonly auditRepository: IAuditRepository;
    constructor({ auditRepository }: Dependencies) { this.auditRepository = auditRepository; }

    async execute(schoolId: string, params: MyOrgActivityParams) {
        return this.auditRepository.paginate({
            page:  params.page  ?? 1,
            limit: params.limit ?? 20,
            where: { schoolId },
            orderBy: { createdAt: "desc" },
        });
    }
}