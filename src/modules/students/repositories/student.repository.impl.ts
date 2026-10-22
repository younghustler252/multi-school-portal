import { BaseTenantRepository, PaginateParams, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { StudentMapper } from "../mappers/student.mapper";
import { StudentEntity } from "../domain/student.entity";
import { IStudentRepository } from "./student.repository";

/*
| STUDENT REPOSITORY. Generic reads and writes come from BaseTenantRepository (the same base Staff uses).
| A student is never erased: `isActive` is the business status, so this repository does not use soft delete.
| Other modules (guardians, enrolment, attendance, report cards...) call this interface: keep its method names.
*/
export class StudentRepositoryImpl extends BaseTenantRepository<StudentEntity> implements IStudentRepository {
    protected readonly modelName = "student";

    constructor({ studentMapper }: { studentMapper: StudentMapper }) { super(studentMapper); }

    async findByUserId(userId: string): Promise<StudentEntity | null> { return this.findOne({ userId }); }
    async findByAdmissionNumber(admissionNumber: string): Promise<StudentEntity | null> { return this.findOne({ admissionNumber }); }

    /**
     * Name or admission-number search. Every word typed must match somewhere ("ada obi" finds Ada Obi),
     * and any filters in params.where are KEPT (they used to be thrown away).
     */
    async searchStudents(query: string, params: PaginateParams): Promise<PaginatedResult<StudentEntity>> {
        const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
        const matchesWord = (w: string) => ({
            OR: [
                { firstName:       { contains: w, mode: "insensitive" } },
                { lastName:        { contains: w, mode: "insensitive" } },
                { middleName:      { contains: w, mode: "insensitive" } },
                { admissionNumber: { contains: w, mode: "insensitive" } },
            ],
        });
        return this.paginate({ ...params, where: { AND: [params.where ?? {}, ...words.map(matchesWord)] } });
    }
}
