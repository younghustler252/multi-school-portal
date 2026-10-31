import { CardSnapshot } from "../domain/report-card.policy";

/*
| The ReportCard table as the report card code sees it (no database import, so it can be used in tests).
| The columns added by migration 20261105090000 (classId, snapshot, generatedById, publishedAt, publishedById, unpublishReason) are typed here by hand,
| so this compiles with any generated Prisma client; after `npm run prisma:generate` they match the generated types.
*/
export interface CardRow {
    id: string; studentId: string; termId: string; classId: string | null; status: string;
    teacherRemark: string | null; principalRemark: string | null;
    totalScore: number | null; averageScore: number | null; position: number | null; totalStudents: number | null;
    snapshot: unknown | null;
    generatedAt: Date | null; generatedById: string | null; publishedAt: Date | null; publishedById: string | null; unpublishReason: string | null;
    emailSentAt: Date | null; smsSentAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface CardWithRefs extends CardRow {
    student: { id: string; firstName: string; lastName: string; admissionNumber: string | null };
    class: { id: string; name: string; classTeacherId: string | null } | null;
    term: { id: string; name: string; session: { id: string; name: string } };
}
export interface CardTable {
    findMany(args: Record<string, unknown>): Promise<CardWithRefs[]>;
    findFirst(args: Record<string, unknown>): Promise<CardWithRefs | null>;
    count(args: Record<string, unknown>): Promise<number>;
    create(args: Record<string, unknown>): Promise<CardRow>;
    update(args: Record<string, unknown>): Promise<CardRow>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}
/** The card table of a client or of a transaction. */
export const cardTable = (client: unknown): CardTable => (client as { reportCard: CardTable }).reportCard;

export const CARD_INCLUDE = {
    student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    class:   { select: { id: true, name: true, classTeacherId: true } },
    term:    { select: { id: true, name: true, session: { select: { id: true, name: true } } } },
} as const;

export const snapshotOf = (row: { snapshot: unknown }): CardSnapshot | null => {
    const s = row.snapshot as CardSnapshot | null;
    return s && typeof s === "object" && Array.isArray(s.fingerprint) && s.result ? s : null;
};
