import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { EnrolmentMapper } from "../mappers/enrolment.mapper";
import { EnrolmentEntity } from "../domain/enrolment.entity";
import { IEnrolmentRepository } from "./enrolment.repository";
import { StudentSummary, EnrolmentTx } from "./enrolment.repository";
import { lockClass, activeInClass } from "../services/class-seats";


export class EnrolmentRepositoryImpl
    extends BaseTenantRepository<EnrolmentEntity>
    implements IEnrolmentRepository
{
    protected readonly modelName = "enrolment";

    constructor({ enrolmentMapper }: { enrolmentMapper: EnrolmentMapper }) {
        super(enrolmentMapper);
    }

    async bulkCreate(data: Prisma.EnrolmentUncheckedCreateInput[]): Promise<EnrolmentEntity[]> {
        const results = await Promise.all(data.map(d => this.model().create({ data: d })));
        return this.mapMany(results);
    }

    async update(id: string, data: Prisma.EnrolmentUncheckedUpdateInput): Promise<EnrolmentEntity> {
        const result = await this.model().update({ where: { id }, data });
        const mapped = this.mapOne(result);
        if (!mapped) throw new Error("Failed to map updated enrolment");
        return mapped;
    }



    async findByStudentAndTerm(studentId: string, termId: string): Promise<EnrolmentEntity | null> {
        return this.findOne({ studentId, termId });
    }

    async findByClass(classId: string, termId: string): Promise<EnrolmentEntity[]> {
        return this.findMany({ classId, termId });
    }

    async findByStudent(studentId: string): Promise<EnrolmentEntity[]> {
        return this.findMany({ studentId });
    }

    async countByClass(classId: string, termId: string): Promise<number> {
        return this.count({ classId, termId, status: "active" });
    }


    async getStudentSummary(studentId: string): Promise<StudentSummary> {
        const student = await this.prisma.student.findUnique({
            where:  { id: studentId },
            select: { id: true, firstName: true, lastName: true },
        });

        return {
            id:        student?.id        ?? studentId,
            firstName: student?.firstName ?? "Unknown",
            lastName:  student?.lastName  ?? "",
        };
    }

    transaction<T>(work: (tx: EnrolmentTx) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(async raw => work({
            lockAndCount: async (classId, termId) => { await lockClass(raw as any, classId); return activeInClass(raw as any, classId, termId); },
            create: data => raw.enrolment.create({ data }),
            createMany: async rows => { await raw.enrolment.createMany({ data: rows.map(r => ({ ...r, status: "active" as const })), skipDuplicates: true }); },
            update: (id, data) => raw.enrolment.update({ where: { id }, data: data as any }),
            completeActive: async (termId, studentIds) => { await raw.enrolment.updateMany({ where: { termId, status: "active", studentId: { in: studentIds } }, data: { status: "completed" } }); },
            studentBranches: ids => raw.student.findMany({ where: { id: { in: ids } }, select: { id: true, branchId: true } }),
            graduate: async (ids, at, termId) => { await raw.student.updateMany({ where: { id: { in: ids }, graduatedAt: null }, data: { graduatedAt: at, graduatedTermId: termId } }); },
        }), { maxWait: 5000, timeout: 30000 });
    }
}
