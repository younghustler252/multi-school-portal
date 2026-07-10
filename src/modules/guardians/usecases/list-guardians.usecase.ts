import { IGuardianRepository }  from "../repositories/guardian.repository";
import { GuardianMapper }       from "../mappers/guardian.mapper";
import { GuardianResponseData } from "../mappers/guardian.mapper";
import { PaginatedResult }      from "../../../infrastructure/repository/base.repository";
import { ListGuardiansDtoType } from "../dtos/guardian.dto";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    guardianMapper:     GuardianMapper;
}

export class ListGuardiansUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly guardianMapper:     GuardianMapper;

    constructor({ guardianRepository, guardianMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.guardianMapper     = guardianMapper;
    }

    async execute(
        dto: ListGuardiansDtoType,
    ): Promise<PaginatedResult<GuardianResponseData>> {

        // ── If filtering by student ───────────────────────────────────────
        if (dto.studentId) {
            const guardians = await this.guardianRepository
                .findByStudentId(dto.studentId);

            return {
                data: guardians.map(g => this.guardianMapper.toResponse(g)),
                meta: {
                    total:      guardians.length,
                    page:       1,
                    limit:      guardians.length,
                    totalPages: 1,
                    hasNext:    false,
                    hasPrev:    false,
                },
            };
        }

        // ── Standard paginated list ───────────────────────────────────────
        const where: Record<string, any> = {};

        if (dto.search) {
            where.OR = [
                { firstName: { contains: dto.search, mode: "insensitive" } },
                { lastName:  { contains: dto.search, mode: "insensitive" } },
                { email:     { contains: dto.search, mode: "insensitive" } },
            ];
        }

        const result = await this.guardianRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(g => this.guardianMapper.toResponse(g)),
            meta: result.meta,
        };
    }
}