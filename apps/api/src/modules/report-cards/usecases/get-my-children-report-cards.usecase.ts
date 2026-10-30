import { IGuardianRepository }    from "../../guardians/repositories/guardian.repository";
import { IReportCardRepository }  from "../repositories/report-card.repository";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { ReportCardMapper }       from "../mappers/report-card.mapper";
import { ReportCardResponseData } from "../mappers/report-card.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ForbiddenError }         from "../../../shared/errors/domain.errors";

interface Dependencies {
    guardianRepository:   IGuardianRepository;
    reportCardRepository: IReportCardRepository;
    storageService:       SupabaseStorageService;
    reportCardMapper:     ReportCardMapper;
}

interface MyChildrenReportCardsParams {
    studentId?: string;
    termId?:    string;
    page?:      number;
    limit?:     number;
}

export class GetMyChildrenReportCardsUseCase {
    private readonly guardianRepository:   IGuardianRepository;
    private readonly reportCardRepository: IReportCardRepository;
    private readonly storageService:       SupabaseStorageService;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({ guardianRepository, reportCardRepository, storageService, reportCardMapper }: Dependencies) {
        this.guardianRepository   = guardianRepository;
        this.reportCardRepository = reportCardRepository;
        this.storageService       = storageService;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(
        userId: string,
        params: MyChildrenReportCardsParams,
    ): Promise<PaginatedResult<ReportCardResponseData>> {
        const childIds = await this.guardianRepository.getChildStudentIds(userId);

        if (params.studentId && !childIds.includes(params.studentId)) {
            throw new ForbiddenError("This student is not linked to your account.");
        }

        const where: Record<string, any> = {
            studentId: params.studentId ?? { in: childIds },
            status:    { in: ["published", "sent"] },
        };
        if (params.termId) where.termId = params.termId;

        const result = await this.reportCardRepository.paginate({
            page:    params.page  ?? 1,
            limit:   params.limit ?? 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        const data = await Promise.all(
            result.data.map(async rc => {
                const response = this.reportCardMapper.toResponse(rc);
                if (response.pdfUrl) {
                    try {
                        response.pdfUrl = await this.storageService.getSignedUrl(response.pdfUrl);
                    } catch {
                        response.pdfUrl = null;
                    }
                }
                return response;
            }),
        );
        console.log("reportcards", data)
        return { data, meta: result.meta };
    }
}