export interface ReportCardEntity {
    id:              string;
    studentId:       string;
    termId:          string;
    status:          string;
    teacherRemark:   string | null;
    principalRemark: string | null;
    totalScore:      number | null;
    averageScore:    number | null;
    position:        number | null;
    totalStudents:   number | null;
    pdfUrl:          string | null;
    emailSentAt:     Date | null;
    smsSentAt:       Date | null;
    generatedAt:     Date | null;
    createdAt:       Date;
    updatedAt:       Date;
}