import { ReportCardBuilder } from "../../src/modules/report-cards/services/report-card-builder.service";
import { CardRow, CardWithRefs, CardTable } from "../../src/modules/report-cards/repositories/card-table";

/* In-memory stand-ins: a repository, a card table that understands the simple filters the use cases send, an access object, an audit log. */
export const parts = [{ position: 1, name: "CA", kind: "ca", maxScore: 40 }, { position: 2, name: "Exam", kind: "exam", maxScore: 60 }];
export const scale = [{ minScore: 0, grade: "F", remark: "Fail", isPass: false }, { minScore: 40, grade: "C", remark: "Credit", isPass: true }, { minScore: 70, grade: "A", remark: "Excellent", isPass: true }];
export const BANDS = scale;

export function access(over: { can?: string[]; scopes?: Record<string, string>; persona?: string; me?: string | null } = {}) {
    const can = new Set(over.can ?? []);
    return {
        persona: over.persona ?? "STAFF", personaEntityId: over.me === undefined ? "t1" : over.me,
        can: (k: string) => can.has(k), scopeOf: (k: string) => can.has(k) ? (over.scopes?.[k] ?? "ALL") : null,
    } as any;
}
export const admin = () => access({ can: ["report_cards.view", "report_cards.generate", "report_cards.principal_remark", "report_cards.publish"] });
export const classTeacher = (me = "t1") => access({ me, can: ["report_cards.view", "report_cards.generate"], scopes: { "report_cards.view": "ASSIGNED", "report_cards.generate": "ASSIGNED" } });

function matches(row: any, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, v]: [string, any]) => {
        if (k === "AND") return (v as any[]).every(w => matches(row, w));
        if (k === "id" || k === "studentId" || k === "termId" || k === "classId" || k === "status") {
            if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
            return row[k] === v;
        }
        return true;   // relation filters (who may see it) are tested on their own
    });
}

export function fakeCards(initial: Array<Partial<CardRow> & { id: string; studentId: string; termId: string }>, names: Record<string, [string, string]> = {}) {
    let n = 100;
    const rows: CardWithRefs[] = initial.map(r => full(r, names));
    function full(r: any, nm: Record<string, [string, string]>): CardWithRefs {
        const [fn, ln] = nm[r.studentId] ?? [r.studentId, "X"];
        return {
            classId: "c1", status: "draft", teacherRemark: null, principalRemark: null, totalScore: null, averageScore: null, position: null, totalStudents: null, snapshot: null,
            generatedAt: null, generatedById: null, publishedAt: null, publishedById: null, unpublishReason: null, emailSentAt: null, smsSentAt: null, createdAt: new Date(), updatedAt: new Date(),
            ...r, student: { id: r.studentId, firstName: fn, lastName: ln, admissionNumber: null }, class: { id: "c1", name: "JSS 1", classTeacherId: "t1" },
            term: { id: r.termId, name: "FIRST", session: { id: "s1", name: "2026/2027" } },
        } as CardWithRefs;
    }
    const table: CardTable = {
        findMany: async a => rows.filter(r => matches(r, (a as any).where)),
        findFirst: async a => rows.find(r => matches(r, (a as any).where)) ?? null,
        count: async a => rows.filter(r => matches(r, (a as any).where)).length,
        create: async (a: any) => { const r = full({ id: `new${n++}`, ...a.data }, names); rows.push(r); return r; },
        update: async (a: any) => { const r = rows.find(x => x.id === a.where.id)!; Object.assign(r, a.data); return r; },
        updateMany: async (a: any) => { const hit = rows.filter(r => matches(r, a.where)); hit.forEach(r => Object.assign(r, a.data)); return { count: hit.length }; },
    };
    return { rows, table };
}

export interface World {
    students: Array<{ id: string; firstName: string; lastName: string; admissionNumber: string | null; gender: string | null }>;
    subjects: Array<{ id: string; name: string; sheet: null | { id: string; status: string; publishedAt: Date; scale?: any } }>;
    scores: Record<string, Record<string, [number, number]>>;   // sheetId -> studentId -> [ca, exam]
    classTeacherId?: string | null;
}
export function fakeRepo(world: World, cardsInit: any[] = []) {
    const { rows, table } = fakeCards(cardsInit, Object.fromEntries(world.students.map(s => [s.id, [s.firstName, s.lastName] as [string, string]])));
    const repo: any = {
        cards: table,
        inTransaction: async (fn: any) => fn(table),
        currentTerm: async () => ({ id: "term1" }),
        term: async (id: string) => id ? ({ id, name: "FIRST", session: { id: "s1", name: "2026/2027" } }) : null,
        classOf: async (id: string) => id === "c1" ? ({ id: "c1", name: "JSS 1", level: "jss", classTeacherId: world.classTeacherId === undefined ? "t1" : world.classTeacherId }) : null,
        studentsOnList: async () => world.students.map(s => ({ studentId: s.id, student: s })),
        subjectsWithSheets: async () => world.subjects.map(s => ({
            id: s.id, subject: { name: s.name }, staff: { firstName: "Mr", lastName: "T" },
            sheet: s.sheet ? { id: s.sheet.id, status: s.sheet.status, components: parts, scale: s.sheet.scale ?? scale, publishedAt: s.sheet.publishedAt } : null,
        })),
        gradesForSheets: async (ids: string[]) => ids.flatMap(sid => Object.entries(world.scores[sid] ?? {}).map(([studentId, [ca, ex]], i) => {
            const total = ca + ex;
            return { sheetId: sid, studentId, total, grade: total >= 70 ? "A" : total >= 40 ? "C" : "F", remark: "r", position: i + 1, totalStudents: Object.keys(world.scores[sid]).length,
                scores: [{ position: 1, score: ca, isAbsent: false }, { position: 2, score: ex, isAbsent: false }] };
        })),
        attendanceByStudent: async () => new Map([["a", [{ status: "present" }, { status: "present" }, { status: "absent" }]]]),
        guardiansOf: async (ids: string[]) => new Map(ids.map(id => [id, [{ id: `g-${id}`, firstName: "Mrs", email: `${id}@x.test`, phone: null, userId: `u-${id}` }]])),
        cardsOfStudents: async (termId: string, ids: string[]) => rows.filter(r => r.termId === termId && ids.includes(r.studentId)),
    };
    const grades: any = { bandsFor: async () => BANDS };
    const builder = new ReportCardBuilder({ reportCardsRepository: repo, gradesSheetsRepository: grades });
    return { repo, rows, builder };
}

export const STUDENTS = ["a", "b", "c"].map(id => ({ id, firstName: id.toUpperCase(), lastName: "Pupil", admissionNumber: null, gender: null }));
export const pub = (id: string, status = "published", at = "2026-10-01T10:00:00Z") => ({ id, status, publishedAt: new Date(at) });
export function worldWith(subjects: Array<{ id: string; name: string; sheet: any }>, scores: World["scores"], extra: Partial<World> = {}): World {
    return { students: STUDENTS, subjects, scores, ...extra };
}
export const auditLog = () => { const entries: any[] = []; return { entries, svc: { log: async (e: any) => { entries.push(e); } } as any }; };
