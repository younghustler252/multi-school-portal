import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { GradeEntity } from "../domain/grade.entity";
import { IGradeRepository } from "./grade.repository";

export class GradeRepositoryImpl implements IGradeRepository {
    /** Only grades whose mark sheet is published (or locked): a draft or a sheet under review is never returned. */
    async findByStudentAndTerm(studentId: string, termId: string): Promise<GradeEntity[]> {
        const rows = await getTenantClient().grade.findMany({
            where: { studentId, termId, sheet: { status: { in: ["published", "locked"] } } },
            orderBy: { createdAt: "asc" },
        });
        return rows.map(r => ({
            id: r.id, studentId: r.studentId, termId: r.termId, classSubjectId: r.classSubjectId, caScore: r.caScore, examScore: r.examScore,
            total: r.total, grade: r.grade, remark: r.remark, position: r.position, totalStudents: r.totalStudents, isPublished: r.isPublished,
            createdAt: r.createdAt, updatedAt: r.updatedAt,
        }));
    }
}
