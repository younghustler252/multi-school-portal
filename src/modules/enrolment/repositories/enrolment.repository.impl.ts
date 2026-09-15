import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { EnrolmentMapper } from "../mappers/enrolment.mapper";
import { EnrolmentEntity } from "../domain/enrolment.entity";
import { IEnrolmentRepository } from "./enrolment.repository";
import { StudentSummary } from "./enrolment.repository";


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
        return this.count({ classId, termId });
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


    
}