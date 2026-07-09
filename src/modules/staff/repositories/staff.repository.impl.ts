import { PrismaClient, Prisma }      from "../../../generated/prisma/client";
import { getTenantClient }   from "../../../infrastructure/database/prisma/prisma.client";
import { StaffMapper }       from "../mappers/staff.mapper";
import { StaffEntity }       from "../domain/staff.entity";
import { IStaffRepository }  from "./staff.repository";
// import staffinpu
import {
    PaginateParams,
    PaginatedResult,
}                            from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                            from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| STAFF REPOSITORY IMPLEMENTATION
| Uses getTenantClient() — queries tenant schema automatically
| Staff table lives in school_greenfield schema, not public
|--------------------------------------------------------------------------
*/

export class StaffRepositoryImpl implements IStaffRepository {
    private readonly mapper: StaffMapper;

    // Tenant client is created per request via getTenantClient()
    private get db(): PrismaClient {
        return getTenantClient();
    }

    constructor({ staffMapper }: { staffMapper: StaffMapper }) {
        this.mapper = staffMapper;
    }

    // ── Find by ID ────────────────────────────────────────────────────────
    async findById(id: string): Promise<StaffEntity | null> {
        const raw = await this.db.staff.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    // ── Find with user data joined ────────────────────────────────────────
    // Staff table has userId but user data is in public schema
    // We fetch staff then enrich with user data separately
    async findWithUser(id: string): Promise<StaffEntity | null> {
        const raw = await this.db.staff.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    // ── Find one ──────────────────────────────────────────────────────────
    async findOne(where: Record<string, any>): Promise<StaffEntity | null> {
        const raw = await this.db.staff.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    // ── Find many ─────────────────────────────────────────────────────────
    async findMany(
        where:    Record<string, any> = {},
        orderBy?: Record<string, any>,
    ): Promise<StaffEntity[]> {
        const raws = await this.db.staff.findMany({
            where,
            orderBy: orderBy ?? { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    // ── Paginate ──────────────────────────────────────────────────────────
    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<StaffEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.staff.findMany({ where, skip, take: limit, orderBy }),
            this.db.staff.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    // ── Paginate with user data ───────────────────────────────────────────
    async paginateWithUser(
        params: PaginateParams,
    ): Promise<PaginatedResult<StaffEntity>> {
        return this.paginate(params);
    }

    // ── Create ────────────────────────────────────────────────────────────
    async create(data: Prisma.StaffUncheckedCreateInput): Promise<StaffEntity> {
        const raw = await this.db.staff.create({ data });
        return this.mapper.toDomain(raw);
    }

    // ── Update ────────────────────────────────────────────────────────────
    async update(
        id:   string,
        data: Prisma.StaffUncheckedUpdateInput,
    ): Promise<StaffEntity> {
        const raw = await this.db.staff.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    // ── Exists ────────────────────────────────────────────────────────────
    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.staff.count({ where });
        return count > 0;
    }

    // ── Count ─────────────────────────────────────────────────────────────
    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.staff.count({ where });
    }

    // ── Find by user ID ───────────────────────────────────────────────────
    async findByUserId(userId: string): Promise<StaffEntity | null> {
        return this.findOne({ userId });
    }

    // ── Find by employee ID ───────────────────────────────────────────────
    async findByEmployeeId(employeeId: string): Promise<StaffEntity | null> {
        return this.findOne({ employeeId });
    }
}