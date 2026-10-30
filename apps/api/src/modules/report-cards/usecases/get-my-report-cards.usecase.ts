import { IStudentRepository }     from "../../students/repositories/student.repository";
import { IReportCardRepository }  from "../repositories/report-card.repository";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { ReportCardMapper }       from "../mappers/report-card.mapper";
import { ReportCardResponseData } from "../mappers/report-card.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { StudentErrorMessage }    from "../../students/domain/student.enums";

interface Dependencies {
    studentRepository:    IStudentRepository;
    reportCardRepository: IReportCardRepository;
    storageService:       SupabaseStorageService;
    reportCardMapper:     ReportCardMapper;
}

interface MyReportCardsParams {
    termId?: string;
    page?:   number;
    limit?:  number;
}

export class GetMyReportCardsUseCase {
    private readonly studentRepository:    IStudentRepository;
    private readonly reportCardRepository: IReportCardRepository;
    private readonly storageService:       SupabaseStorageService;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({ studentRepository, reportCardRepository, storageService, reportCardMapper }: Dependencies) {
        this.studentRepository    = studentRepository;
        this.reportCardRepository = reportCardRepository;
        this.storageService       = storageService;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(
        userId: string,
        params: MyReportCardsParams,
    ): Promise<PaginatedResult<ReportCardResponseData>> {
        const student = await this.studentRepository.findByUserId(userId);

        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const where: Record<string, any> = {
            studentId: student.id,
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

        return { data, meta: result.meta };
    }
}