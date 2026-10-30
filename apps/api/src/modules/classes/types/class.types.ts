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
    defaultTeacherId: string | null;
    createdAt: Date;
}

export interface EnrichedSubject extends SubjectResponseData {
    defaultTeacherName: string | null;
}
export interface ClassSubjectResponseData {
    id: string;
    classId: string;
    subjectId: string;
    staffId: string | null;
    termId: string;
    assignedVia: "manual" | "auto_subject_default" | "auto_homeroom" | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EnrichedClassSubject extends ClassSubjectResponseData {
    className: string;
    subjectName: string;
    subjectCode: string | null;
    staffName: string | null;
}

export interface ClassProgressionResponseData {
    id: string;
    fromClassId: string;
    fromClassName: string;
    toClassId: string | null;
    toClassName: string | null;
    createdAt: Date;
    updatedAt: Date;
}
