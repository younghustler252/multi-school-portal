import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import { PaginatedResult }    from "../../../infrastructure/repository/base.repository";
import { ListStaffDtoType }   from "../dtos/staff.dto";
import {
    parsePagination,
    buildPaginationMeta,
}                             from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| LIST STAFF USE CASE
| Paginated list of all staff with user data
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
    staffMapper:     StaffMapper;
}

export class ListStaffUseCase {
    private readonly staffRepository: IStaffRepository;
    private readonly userRepository:  IUserRepository;
    private readonly staffMapper:     StaffMapper;

    constructor({
        staffRepository,
        userRepository,
        staffMapper,
    }: Dependencies) {
        this.staffRepository = staffRepository;
        this.userRepository  = userRepository;
        this.staffMapper     = staffMapper;
    }

    async execute(
        dto: ListStaffDtoType,
    ): Promise<PaginatedResult<StaffResponseData>> {

        // ── Build filters ─────────────────────────────────────────────────
        const where: Record<string, any> = {};

        if (dto.role)     where.role     = dto.role;
        if (dto.department) where.department = dto.department;
        if (dto.isActive !== undefined) {
            where.isActive = dto.isActive === "true";
        }

        const { page, limit, skip } = parsePagination({
            page:  Number(dto.page),
            limit: Number(dto.limit),
        });

        // ── Paginate staff ────────────────────────────────────────────────
        const result = await this.staffRepository.paginate({
            page,
            limit,
            where,
            orderBy: { createdAt: "desc" },
        });

        // ── Enrich with user data ─────────────────────────────────────────
        const enriched = await Promise.all(
            result.data.map(async staff => {
                const user = await this.userRepository.findById(staff.userId);
                return this.staffMapper.toResponse({
                    ...staff,
                    firstName: user?.firstName ?? null,
                    lastName:  user?.lastName  ?? null,
                    email:     user?.email,
                    phone:     user?.phone     ?? null,
                    photoUrl:  user?.photoUrl  ?? null,
                });
            }),
        );

        return {
            data: enriched,
            meta: result.meta,
        };
    }
}