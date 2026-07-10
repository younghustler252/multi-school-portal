import { PrismaClient, Prisma }      from "../../../generated/prisma/client";
import { getTenantClient }         from "../../../infrastructure/database/prisma/prisma.client";
import { GuardianMapper }          from "../mappers/guardian.mapper";
import {
    GuardianEntity,
    StudentGuardianEntity,
}                                  from "../domain/guardian.entity";
import { IGuardianRepository }     from "./guardian.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                  from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                  from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| GUARDIAN REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class GuardianRepositoryImpl implements IGuardianRepository {
    private readonly mapper: GuardianMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({ guardianMapper }: { guardianMapper: GuardianMapper }) {
        this.mapper = guardianMapper;
    }

    async findById(id: string): Promise<GuardianEntity | null> {
        const raw = await this.db.guardian.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(
        where: Record<string, any>,
    ): Promise<GuardianEntity | null> {
        const raw = await this.db.guardian.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(
        where: Record<string, any> = {},
    ): Promise<GuardianEntity[]> {
        const raws = await this.db.guardian.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<GuardianEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.guardian.findMany({ where, skip, take: limit, orderBy }),
            this.db.guardian.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.GuardianUncheckedCreateInput): Promise<GuardianEntity> {
        const raw = await this.db.guardian.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Prisma.GuardianUncheckedUpdateInput,
    ): Promise<GuardianEntity> {
        const raw = await this.db.guardian.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.guardian.count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.guardian.count({ where });
    }

    async findByEmail(email: string): Promise<GuardianEntity | null> {
        return this.findOne({ email });
    }

    async findByStudentId(studentId: string): Promise<GuardianEntity[]> {
        const links = await this.db.studentGuardian.findMany({
            where: { studentId },
        });

        const guardians = await Promise.all(
            links.map(link =>
                this.db.guardian.findUnique({
                    where: { id: link.guardianId },
                }),
            ),
        );

        return guardians
            .filter(Boolean)
            .map(r => this.mapper.toDomain(r));
    }

    async findByUserId(userId: string): Promise<GuardianEntity | null> {
        return this.findOne({ userId });
    }

    async linkToStudent(
        data: Prisma.StudentGuardianUncheckedCreateInput,
    ): Promise<StudentGuardianEntity> {
        return this.db.studentGuardian.create({
            data,
        }) as unknown as StudentGuardianEntity;
    }

    async unlinkFromStudent(
        guardianId: string,
        studentId:  string,
    ): Promise<void> {
        await this.db.studentGuardian.deleteMany({
            where: { guardianId, studentId },
        });
    }

    async isLinked(
        guardianId: string,
        studentId:  string,
    ): Promise<boolean> {
        const count = await this.db.studentGuardian.count({
            where: { guardianId, studentId },
        });
        return count > 0;
    }

    async updateLink(
        guardianId: string,
        studentId:  string,
        data:       Record<string, any>,
    ): Promise<StudentGuardianEntity> {
        return this.db.studentGuardian.update({
            where: {
                studentId_guardianId: { studentId, guardianId },
            },
            data,
        }) as unknown as StudentGuardianEntity;
    }
}