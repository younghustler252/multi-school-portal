/*
|--------------------------------------------------------------------------
| GRADE ENTITY (what report cards read)
| One student's result in one subject for one term, from a PUBLISHED mark sheet. Marks are entered, reviewed and published
| through mark sheets (see grades-sheets); nothing here changes a grade.
|--------------------------------------------------------------------------
*/
export interface GradeEntity {
    id:             string;
    studentId:      string;
    termId:         string;
    classSubjectId: string;
    caScore:        number | null;
    examScore:      number | null;
    total:          number | null;
    grade:          string | null;
    remark:         string | null;
    position:       number | null;   // position in the class for THIS subject (ties share one). The overall class position is a report card matter.
    totalStudents:  number | null;   // how many students were ranked in this subject
    isPublished:    boolean;
    createdAt:      Date;
    updatedAt:      Date;
}
