import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
    ClassProgressionEntity,
} from "../domain/class.entity";
import { ClassSubjectAssignmentSource } from "../domain/class.enums";
import { ClassProgressionResponseData } from "../types/class.types";

export interface IClassRepository {
    findClassById(id: string):                     Promise<ClassEntity | null>;
    findClassByName(name: string):                 Promise<ClassEntity | null>;
    findAllClasses():                               Promise<ClassEntity[]>;
    createClass(data: Record<string, any>):         Promise<ClassEntity>;
    updateClass(id: string, data: Record<string, any>): Promise<ClassEntity>;
    deleteClass(id: string):                        Promise<ClassEntity>;

    findSubjectById(id: string):                    Promise<SubjectEntity | null>;
    findSubjectByCode(code: string):                Promise<SubjectEntity | null>;
    setSubjectDefaultTeacher(
        subjectId: string, staffId: string | null,
    ): Promise<SubjectEntity>;
    findAllSubjects():                              Promise<SubjectEntity[]>;
    createSubject(data: Record<string, any>):       Promise<SubjectEntity>;
    updateSubject(id: string, data: Record<string, any>): Promise<SubjectEntity>;
    deleteSubject(id: string):                      Promise<SubjectEntity>;

    // ── ClassSubject — now term-scoped ────────────────────────────────────
    findClassSubjects(classId: string, termId: string):              Promise<ClassSubjectEntity[]>;
    findClassSubject(classId: string, subjectId: string, termId: string): Promise<ClassSubjectEntity | null>;
    findClassSubjectById(id: string):                                Promise<ClassSubjectEntity | null>;
    findClassSubjectsByTerm(classId: string, termId: string):        Promise<ClassSubjectEntity[]>;
    findClassSubjectsBySubjectAndTerm(subjectId: string, termId: string): Promise<ClassSubjectEntity[]>;
    assignSubject(data: {
        classId:     string;
        subjectId:   string;
        staffId:     string;
        termId:      string;
        assignedVia: ClassSubjectAssignmentSource;
    }): Promise<ClassSubjectEntity>;
    updateClassSubject(id: string, data: Record<string, any>): Promise<ClassSubjectEntity>;
    removeSubject(id: string):                      Promise<void>;

    findStaffAssignments(staffId: string, termId: string): Promise<Array<{
        classSubjectId: string;
        classId:        string;
        className:      string;
        subjectId:      string;
        subjectName:    string;
        subjectCode:    string | null;
    }>>;

   findClassSubjectsEnriched(
        classId: string,
        termId: string,
    ): Promise<Array<{
        classSubjectId: string | null;
        classId:        string;
        className:      string;
        subjectId:      string;
        subjectName:    string;
        subjectCode:    string | null;
        staffId:        string | null;
        termId:         string;
        assignedVia:    ClassSubjectAssignmentSource | null;
    }>>;

    findSubjectNamesByClassSubjectIds(ids: string[]): Promise<Map<string, string>>;

    findAllClassesEnriched(termId: string | null): Promise<Array<{
        id:             string;
        name:           string;
        level:          string | null;
        capacity:       number | null;
        classTeacherId: string | null;
        studentCount:   number;
        createdAt:      Date;
    }>>;

    findClassByIdEnriched(id: string, termId: string | null): Promise<{
        id:             string;
        name:           string;
        level:          string | null;
        capacity:       number | null;
        classTeacherId: string | null;
        studentCount:   number;
        createdAt:      Date;
    } | null>;

    findAllClassProgressions(): Promise<Array<{ fromClassId: string; toClassId: string | null }>>;
    findClassProgression(fromClassId: string):      Promise<ClassProgressionEntity | null>;
    setClassProgression(data: { fromClassId: string; toClassId: string | null }): Promise<ClassProgressionEntity>;
    findClassProgressionEnriched(fromClassId: string): Promise<ClassProgressionResponseData | null>;

    findClassesByClassTeacher(staffId: string): Promise<Array<{
        classId:      string;
        className:    string;
        studentCount: number;
    }>>;
}