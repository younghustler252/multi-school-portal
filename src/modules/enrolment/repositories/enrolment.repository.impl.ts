import { Prisma } from "../../../generated/prisma/client";
import { getTenantClient }        from "../../../infrastructure/database/prisma/prisma.client";
import { EnrolmentMapper }        from "../mappers/enrolment.mapper";
import { EnrolmentEntity }        from "../domain/enrolment.entity";
import { IEnrolmentRepository }   from "./enrolment.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                 from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                 from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| ENROLMENT REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class EnrolmentRepositoryImpl implements IEnrolmentRepository {
    private readonly mapper: EnrolmentMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({ enrolmentMapper }: { enrolmentMapper: EnrolmentMapper }) {
        this.mapper = enrolmentMapper;
    }

    async findById(id: string): Promise<EnrolmentEntity | null> {
        const raw = await this.db.enrolment.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(
        where: Record<string, any>,
    ): Promise<EnrolmentEntity | null> {
        const raw = await this.db.enrolment.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(
        where: Record<string, any> = {},
    ): Promise<EnrolmentEntity[]> {
        const raws = await this.db.enrolment.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<EnrolmentEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.enrolment.findMany({ where, skip, take: limit, orderBy }),
            this.db.enrolment.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.EnrolmentUncheckedCreateInput): Promise<EnrolmentEntity> {
        const raw = await this.db.enrolment.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Prisma.EnrolmentUncheckedUpdateInput,
    ): Promise<EnrolmentEntity> {
        const raw = await this.db.enrolment.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.enrolment.count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.enrolment.count({ where });
    }

    async findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ): Promise<EnrolmentEntity | null> {
        return this.findOne({ studentId, termId });
    }

    async findByClass(
        classId: string,
        termId:  string,
    ): Promise<EnrolmentEntity[]> {
        return this.findMany({ classId, termId });
    }

    async findByStudent(studentId: string): Promise<EnrolmentEntity[]> {
        return this.findMany({ studentId });
    }

    async countByClass(
        classId: string,
        termId:  string,
    ): Promise<number> {
        return this.count({ classId, termId });
    }

    async bulkCreate(
        data: Prisma.EnrolmentUncheckedCreateInput[],
    ): Promise<EnrolmentEntity[]> {
        const results = await Promise.all(
            data.map(d => this.db.enrolment.create({ data: d })),
        );
        return results.map(r => this.mapper.toDomain(r));
    }
}