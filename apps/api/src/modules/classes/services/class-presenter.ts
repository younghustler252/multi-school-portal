import { StaffNameLookup, StaffRef } from "./staff-names";

/*
| CLASS RESPONSES carry names, not bare ids: the class teacher is { id, name }, the class a class is promoted into
| is { id, name } (null = it graduates). One lookup fills a whole page.
*/
export interface ClassRow {
    id: string; name: string; level: string | null; capacity: number | null;
    classTeacherId: string | null; studentCount: number; createdAt: Date;
}
export interface NameRef { id: string; name: string }

export interface ClassResponse {
    id:           string;
    name:         string;
    level:        string | null;
    capacity:     number | null;
    classTeacher: StaffRef | null;
    studentCount: number;
    nextClass?:   NameRef | null;
    createdAt:    Date;
}

export class ClassPresenter {
    constructor(private readonly d: { staffNameLookup: StaffNameLookup }) {}

    async many(rows: ClassRow[]): Promise<ClassResponse[]> {
        const names = await this.d.staffNameLookup.byIds(rows.map(r => r.classTeacherId));
        return rows.map(r => this.build(r, r.classTeacherId ? names.get(r.classTeacherId) ?? null : null));
    }

    async one(row: ClassRow, nextClass?: NameRef | null): Promise<ClassResponse> {
        const res = (await this.many([row]))[0];
        return nextClass === undefined ? res : { ...res, nextClass };
    }

    private build(r: ClassRow, classTeacher: StaffRef | null): ClassResponse {
        return { id: r.id, name: r.name, level: r.level, capacity: r.capacity, classTeacher, studentCount: r.studentCount, createdAt: r.createdAt };
    }
}
