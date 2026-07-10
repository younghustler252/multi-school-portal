import { PrismaClient, Prisma }      from "../../../generated/prisma/client";
import { getTenantClient }       from "../../../infrastructure/database/prisma/prisma.client";
import { StudentMapper }         from "../mappers/student.mapper";
import { StudentEntity }         from "../domain/student.entity";
import { IStudentRepository }    from "./student.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| STUDENT REPOSITORY IMPLEMENTATION
| Uses getTenantClient() — queries tenant schema automatically
|--------------------------------------------------------------------------
*/

export class StudentRepositoryImpl implements IStudentRepository {
    private readonly mapper: StudentMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({ studentMapper }: { studentMapper: StudentMapper }) {
        this.mapper = studentMapper;
    }

    async findById(id: string): Promise<StudentEntity | null> {
        const raw = await this.db.student.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(
        where: Record<string, any>,
    ): Promise<StudentEntity | null> {
        const raw = await this.db.student.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(
        where:    Record<string, any> = {},
        orderBy?: Record<string, any>,
    ): Promise<StudentEntity[]> {
        const raws = await this.db.student.findMany({
            where,
            orderBy: orderBy ?? { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<StudentEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.student.findMany({ where, skip, take: limit, orderBy }),
            this.db.student.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.StudentUncheckedCreateInput): Promise<StudentEntity> {
        const raw = await this.db.student.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Record<string, any>,
    ): Promise<StudentEntity> {
        const raw = await this.db.student.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.student.count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.student.count({ where });
    }

    async findByAdmissionNumber(
        admissionNumber: string,
    ): Promise<StudentEntity | null> {
        return this.findOne({ admissionNumber });
    }

    async searchStudents(
        query:  string,
        params: PaginateParams,
    ): Promise<PaginatedResult<StudentEntity>> {
        return this.paginate({
            ...params,
            where: {
                OR: [
                    { firstName:       { contains: query, mode: "insensitive" } },
                    { lastName:        { contains: query, mode: "insensitive" } },
                    { admissionNumber: { contains: query, mode: "insensitive" } },
                ],
            },
        });
    }
}