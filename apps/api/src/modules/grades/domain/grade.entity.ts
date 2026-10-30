/*
|--------------------------------------------------------------------------
| GRADE DOMAIN ENTITIES
| Tenant-level entities
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
    position:       number | null;
    totalStudents:  number | null;
    isPublished:    boolean;
    createdAt:      Date;
    updatedAt:      Date;
}

export interface GradingConfigEntity {
    id:        string;
    minScore:  number;
    maxScore:  number;
    grade:     string;
    remark:    string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}