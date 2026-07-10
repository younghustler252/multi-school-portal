import { Prisma } from "../../../generated/prisma/client";
import { getTenantClient }          from "../../../infrastructure/database/prisma/prisma.client";
import { AttendanceMapper }         from "../mappers/attendance.mapper";
import { AttendanceEntity }         from "../domain/attendance.entity";
import { IAttendanceRepository }    from "./attendance.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                   from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                   from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| ATTENDANCE REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class AttendanceRepositoryImpl implements IAttendanceRepository {
    private readonly mapper: AttendanceMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({ attendanceMapper }: { attendanceMapper: AttendanceMapper }) {
        this.mapper = attendanceMapper;
    }

    async findById(id: string): Promise<AttendanceEntity | null> {
        const raw = await this.db.attendance.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(
        where: Record<string, any>,
    ): Promise<AttendanceEntity | null> {
        const raw = await this.db.attendance.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(
        where: Record<string, any> = {},
    ): Promise<AttendanceEntity[]> {
        const raws = await this.db.attendance.findMany({
            where,
            orderBy: { date: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<AttendanceEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { date: "desc" };

        const [raws, total] = await Promise.all([
            this.db.attendance.findMany({
                where, skip, take: limit, orderBy,
            }),
            this.db.attendance.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(
        data: Prisma.AttendanceUncheckedCreateInput,
    ): Promise<AttendanceEntity> {
        const raw = await this.db.attendance.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Record<string, any>,
    ): Promise<AttendanceEntity> {
        const raw = await this.db.attendance.update({
            where: { id },
            data,
        });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.attendance.count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.attendance.count({ where });
    }

    async bulkCreate(
        data: Prisma.AttendanceUncheckedCreateInput[],
    ): Promise<AttendanceEntity[]> {
        const results = await Promise.all(
            data.map(d => this.db.attendance.create({ data: d })),
        );
        return results.map(r => this.mapper.toDomain(r));
    }

    async findByStudentAndDate(
        studentId: string,
        date:      Date,
    ): Promise<AttendanceEntity | null> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const raw = await this.db.attendance.findFirst({
            where: {
                studentId,
                date: { gte: startOfDay, lte: endOfDay },
            },
        });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findByTermAndDate(
        termId: string,
        date:   Date,
    ): Promise<AttendanceEntity[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.findMany({
            termId,
            date: { gte: startOfDay, lte: endOfDay },
        });
    }

    async findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ): Promise<AttendanceEntity[]> {
        return this.findMany({ studentId, termId });
    }

    async countByStatus(
        studentId: string,
        termId:    string,
        status:    string,
    ): Promise<number> {
        return this.count({ studentId, termId, status });
    }
}