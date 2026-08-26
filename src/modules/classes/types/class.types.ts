export interface ClassResponseData {
    id: string;
    name: string;
    level: string | null;
    capacity: number | null;
    classTeacherId: string | null;
    classTeacherName: string | null;
    studentCount: number;
    createdAt: Date;
}

export interface EnrichedClass {
    id: string;
    name: string;
    level: string | null;
    capacity: number | null;
    classTeacherId: string | null;
    classTeacherName: string | null;
    studentCount: number;
    createdAt: Date;
}

export interface SubjectResponseData {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    createdAt: Date;
}

export interface ClassSubjectResponseData {
    id: string;
    classId: string;
    subjectId: string;
    staffId: string;
    createdAt: Date;
}