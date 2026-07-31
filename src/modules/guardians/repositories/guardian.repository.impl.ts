import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
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
        return this.findOne({ email });
    }

    async findByStudentId(studentId: string): Promise<GuardianEntity[]> {
        const links = await this.prisma.studentGuardian.findMany({ where: { studentId } });

        const guardians = await Promise.all(
            links.map(link => this.prisma.guardian.findUnique({ where: { id: link.guardianId } })),
        );

        return this.mapMany(guardians.filter(Boolean) as any[]);
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
}