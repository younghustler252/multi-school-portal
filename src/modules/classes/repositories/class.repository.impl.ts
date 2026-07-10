import { Prisma } from "../../../generated/prisma/client";
import { getTenantClient }       from "../../../infrastructure/database/prisma/prisma.client";
import { ClassMapper, SubjectMapper, ClassSubjectMapper } from "../mappers/class.mapper";
import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
}                                from "../domain/class.entity";
import { IClassRepository }      from "./class.repository";

/*
|--------------------------------------------------------------------------
| CLASS REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class ClassRepositoryImpl implements IClassRepository {
    private readonly classMapper:        ClassMapper;
    private readonly subjectMapper:      SubjectMapper;
    private readonly classSubjectMapper: ClassSubjectMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({
        classMapper,
        subjectMapper,
        classSubjectMapper,
    }: {
        classMapper:        ClassMapper;
        subjectMapper:      SubjectMapper;
        classSubjectMapper: ClassSubjectMapper;
    }) {
        this.classMapper        = classMapper;
        this.subjectMapper      = subjectMapper;
        this.classSubjectMapper = classSubjectMapper;
    }

    // ── Classes ───────────────────────────────────────────────────────────
    async findClassById(id: string): Promise<ClassEntity | null> {
        const raw = await this.db.class.findUnique({ where: { id } });
        return raw ? this.classMapper.toDomain(raw) : null;
    }

    async findClassByName(name: string): Promise<ClassEntity | null> {
        const raw = await this.db.class.findFirst({ where: { name } });
        return raw ? this.classMapper.toDomain(raw) : null;
    }

    async findAllClasses(): Promise<ClassEntity[]> {
        const raws = await this.db.class.findMany({
            orderBy: { name: "asc" },
        });
        return raws.map(r => this.classMapper.toDomain(r));
    }

    async createClass(data: Prisma.ClassUncheckedCreateInput): Promise<ClassEntity> {
        const raw = await this.db.class.create({ data });
        return this.classMapper.toDomain(raw);
    }

    async updateClass(
        id:   string,
        data: Prisma.ClassUncheckedUpdateInput,
    ): Promise<ClassEntity> {
        const raw = await this.db.class.update({ where: { id }, data });
        return this.classMapper.toDomain(raw);
    }

    async deleteClass(id: string): Promise<ClassEntity> {
        const raw = await this.db.class.delete({ where: { id } });
        return this.classMapper.toDomain(raw);
    }

    // ── Subjects ──────────────────────────────────────────────────────────
    async findSubjectById(id: string): Promise<SubjectEntity | null> {
        const raw = await this.db.subject.findUnique({ where: { id } });
        return raw ? this.subjectMapper.toDomain(raw) : null;
    }

    async findSubjectByCode(code: string): Promise<SubjectEntity | null> {
        const raw = await this.db.subject.findFirst({ where: { code } });
        return raw ? this.subjectMapper.toDomain(raw) : null;
    }

    async findAllSubjects(): Promise<SubjectEntity[]> {
        const raws = await this.db.subject.findMany({
            orderBy: { name: "asc" },
        });
        return raws.map(r => this.subjectMapper.toDomain(r));
    }

    async createSubject(data: Prisma.SubjectUncheckedCreateInput): Promise<SubjectEntity> {
        const raw = await this.db.subject.create({ data });
        return this.subjectMapper.toDomain(raw);
    }

    async updateSubject(
        id:   string,
        data: Record<string, any>,
    ): Promise<SubjectEntity> {
        const raw = await this.db.subject.update({ where: { id }, data });
        return this.subjectMapper.toDomain(raw);
    }

    async deleteSubject(id: string): Promise<SubjectEntity> {
        const raw = await this.db.subject.delete({ where: { id } });
        return this.subjectMapper.toDomain(raw);
    }

    // ── Class Subjects ────────────────────────────────────────────────────
    async findClassSubjects(
        classId: string,
    ): Promise<ClassSubjectEntity[]> {
        const raws = await this.db.classSubject.findMany({
            where: { classId },
        });
        return raws.map(r => this.classSubjectMapper.toDomain(r));
    }

    async findClassSubject(
        classId:   string,
        subjectId: string,
    ): Promise<ClassSubjectEntity | null> {
        const raw = await this.db.classSubject.findFirst({
            where: { classId, subjectId },
        });
        return raw ? this.classSubjectMapper.toDomain(raw) : null;
    }

    async assignSubject(
        data: Prisma.ClassSubjectUncheckedCreateInput,
    ): Promise<ClassSubjectEntity> {
        const raw = await this.db.classSubject.create({ data });
        return this.classSubjectMapper.toDomain(raw);
    }

    async updateClassSubject(
        id:   string,
        data: Prisma.ClassSubjectUncheckedUpdateInput,
    ): Promise<ClassSubjectEntity> {
        const raw = await this.db.classSubject.update({
            where: { id },
            data,
        });
        return this.classSubjectMapper.toDomain(raw);
    }

    async removeSubject(id: string): Promise<void> {
        await this.db.classSubject.delete({ where: { id } });
    }

    async findStaffSubjects(
        staffId: string,
    ): Promise<ClassSubjectEntity[]> {
        const raws = await this.db.classSubject.findMany({
            where: { staffId },
        });
        return raws.map(r => this.classSubjectMapper.toDomain(r));
    }
}