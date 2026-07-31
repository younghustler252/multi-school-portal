import { Prisma } from "../../../generated/tenant";
import {
    BaseTenantRepository,
    PaginateParams,
    PaginatedResult,
} from "../../../infrastructure/repository/base.repository";
import { AttendanceMapper } from "../mappers/attendance.mapper";
import { AttendanceEntity } from "../domain/attendance.entity";
import { IAttendanceRepository } from "./attendance.repository";

export class AttendanceRepositoryImpl
    extends BaseTenantRepository<AttendanceEntity>
    implements IAttendanceRepository
{
    protected readonly modelName = "attendance";

    constructor({ attendanceMapper }: { attendanceMapper: AttendanceMapper }) {
        super(attendanceMapper);
    }

    async findMany(where: Record<string, any> = {}): Promise<AttendanceEntity[]> {
        return super.findMany(where, undefined, { date: "desc" });
    }

    async paginate(params: PaginateParams): Promise<PaginatedResult<AttendanceEntity>> {
        return super.paginate({ orderBy: { date: "desc" }, ...params });
    }

    async bulkCreate(data: Prisma.AttendanceUncheckedCreateInput[]): Promise<AttendanceEntity[]> {
        const results = await Promise.all(data.map(d => this.model().create({ data: d })));
        return this.mapMany(results);
    }

    async findByStudentAndDate(studentId: string, date: Date): Promise<AttendanceEntity | null> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.findOne({
            studentId,
            date: { gte: startOfDay, lte: endOfDay },
        });
    }

    async findByTermAndDate(termId: string, date: Date): Promise<AttendanceEntity[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.findMany({
            termId,
            date: { gte: startOfDay, lte: endOfDay },
        });
    }

    async findByStudentAndTerm(studentId: string, termId: string): Promise<AttendanceEntity[]> {
        return this.findMany({ studentId, termId });
    }

    async countByStatus(studentId: string, termId: string, status: string): Promise<number> {
        return this.count({ studentId, termId, status });
    }
}