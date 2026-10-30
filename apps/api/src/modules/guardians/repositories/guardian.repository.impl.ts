import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository, PaginateParams, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { GuardianMapper } from "../mappers/guardian.mapper";
import { GuardianEntity, StudentGuardianEntity } from "../domain/guardian.entity";
import { IGuardianRepository } from "./guardian.repository";

export class GuardianRepositoryImpl
    extends BaseTenantRepository<GuardianEntity>
    implements IGuardianRepository
{
    protected readonly modelName = "guardian";

    constructor({ guardianMapper }: { guardianMapper: GuardianMapper }) {
        super(guardianMapper);
    }

    async findByEmail(email: string): Promise<GuardianEntity | null> {
        return this.findOne({ email: { equals: email.trim(), mode: "insensitive" } });   // any capitals
    }

    async findByStudentId(studentId: string): Promise<GuardianEntity[]> {
        const rows = await this.prisma.guardian.findMany({ where: { studentLinks: { some: { studentId } } }, orderBy: { createdAt: "asc" } });   // one query
        return this.mapMany(rows as any[]);
    }

    /** Name, email or phone search. Every word typed must match somewhere; filters in params.where are KEPT. */
    async searchGuardians(query: string, params: PaginateParams): Promise<PaginatedResult<GuardianEntity>> {
        const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
        const matchesWord = (w: string) => ({
            OR: [
                { firstName: { contains: w, mode: "insensitive" } }, { lastName: { contains: w, mode: "insensitive" } },
                { email:     { contains: w, mode: "insensitive" } }, { phone:    { contains: w } },
            ],
        });
        return this.paginate({ ...params, where: { AND: [params.where ?? {}, ...words.map(matchesWord)] } });
    }

    async findByUserId(userId: string): Promise<GuardianEntity | null> {
        return this.findOne({ userId });
    }

    async linkToStudent(data: Prisma.StudentGuardianUncheckedCreateInput): Promise<StudentGuardianEntity> {
        return this.prisma.studentGuardian.create({ data }) as unknown as StudentGuardianEntity;
    }

    async unlinkFromStudent(guardianId: string, studentId: string): Promise<void> {
        await this.prisma.studentGuardian.deleteMany({ where: { guardianId, studentId } });
    }

    async isLinked(guardianId: string, studentId: string): Promise<boolean> {
        const count = await this.prisma.studentGuardian.count({ where: { guardianId, studentId } });
        return count > 0;
    }

    async updateLink(guardianId: string, studentId: string, data: Record<string, any>): Promise<StudentGuardianEntity> {
        return this.prisma.studentGuardian.update({
            where: { studentId_guardianId: { studentId, guardianId } },
            data,
        }) as unknown as StudentGuardianEntity;
    }

    async findGuardianLinksByStudentId(
        studentId: string,
    ): Promise<Array<{ guardian: GuardianEntity; relation: string; isPrimary: boolean }>> {
        const links = await this.prisma.studentGuardian.findMany({
            where:   { studentId },
            include: { guardian: true },
        });

        return links.map(link => ({
            guardian:  this.mapper.toDomain(link.guardian),
            relation:  link.relation,
            isPrimary: link.isPrimary,
        }));
    }
    async findStudentLinksByGuardianId(
        guardianId: string,
    ): Promise<Array<{ studentId: string; relation: string; isPrimary: boolean }>> {
        const links = await this.prisma.studentGuardian.findMany({
            where: { guardianId },
        });

        return links.map(link => ({
            studentId: link.studentId,
            relation:  link.relation,
            isPrimary: link.isPrimary,
        }));
    }
   
    async isGuardianOfStudentByUserId(userId: string, studentId: string): Promise<boolean> {
        const guardian = await this.prisma.guardian.findUnique({ where: { userId } });
        if (!guardian) return false;

        return this.isLinked(guardian.id, studentId);
    }

    async getChildStudentIds(userId: string): Promise<string[]> {
        const guardian = await this.prisma.guardian.findUnique({ where: { userId } });
        if (!guardian) return [];

        const links = await this.prisma.studentGuardian.findMany({
            where:  { guardianId: guardian.id },
            select: { studentId: true },
        });

        return links.map(l => l.studentId);
    }
}