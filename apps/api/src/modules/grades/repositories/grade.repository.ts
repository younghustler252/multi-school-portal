import { GradeEntity } from "../domain/grade.entity";

/* READ-ONLY. Report cards (and anything else that shows results) read PUBLISHED grades only. */
export interface IGradeRepository {
    findByStudentAndTerm(studentId: string, termId: string): Promise<GradeEntity[]>;
}
