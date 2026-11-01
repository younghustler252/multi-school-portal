import { z } from "zod";

const id = z.string().uuid();
const remark = z.string().trim().max(500).nullable();

/** POST /report-cards/generate: build (or rebuild) DRAFT cards for a class. studentIds empty = everyone on the class list. termId default = current term. */
export const GenerateReportCardsRequest = z.object({ classId: id, termId: id.optional(), studentIds: z.array(id).min(1).max(200).optional() }).strict();
export type GenerateReportCardsRequest = z.infer<typeof GenerateReportCardsRequest>;

/** PUT /report-cards/:id/remarks (null or empty clears; teacher remark needs report_cards.generate, principal remark needs report_cards.principal_remark) */
export const ReportCardRemarksRequest = z.object({ teacherRemark: remark.optional(), principalRemark: remark.optional() }).strict()
    .refine(v => v.teacherRemark !== undefined || v.principalRemark !== undefined, { message: "Send a teacher remark, a principal remark, or both" });
export type ReportCardRemarksRequest = z.infer<typeof ReportCardRemarksRequest>;

/** POST /report-cards/publish (allowMissing: publish although some subjects are not published yet) */
export const PublishReportCardsRequest = z.object({ ids: z.array(id).min(1).max(200), allowMissing: z.boolean().optional() }).strict();
export type PublishReportCardsRequest = z.infer<typeof PublishReportCardsRequest>;

/** POST /report-cards/unpublish */
export const UnpublishReportCardsRequest = z.object({ ids: z.array(id).min(1).max(200), reason: z.string().trim().min(5, "Please say why (at least 5 characters)").max(500) }).strict();
export type UnpublishReportCardsRequest = z.infer<typeof UnpublishReportCardsRequest>;

/** Query of GET /report-cards */
export const ListReportCardsQueryRequest = z.object({
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
    termId: id.optional(), classId: id.optional(), studentId: id.optional(), status: z.enum(["draft", "published", "sent"]).optional(),
});
export type ListReportCardsQueryRequest = z.infer<typeof ListReportCardsQueryRequest>;

/** draft: built, remarks editable, hidden from families. published: frozen and visible. sent: guardians were told. ("generated" is legacy and never appears.) */
export type ReportCardStatus = "draft" | "published" | "sent";

export interface ReportCardSubject {
    classSubjectId: string; subjectName: string; teacher: string | null;
    parts: { position: number; name: string; kind: "ca" | "exam"; maxScore: number; score: number | null; absent: boolean }[];
    ca: number | null; exam: number | null; total: number | null; grade: string | null; remark: string | null; isPass: boolean | null; position: number | null; outOf: number | null;
}
export interface ReportCardSnapshot {
    version: number; generatedAt: string; fingerprint: string[]; session: string; term: string;
    class: { id: string; name: string; level: string | null };
    student: { id: string; firstName: string; lastName: string; admissionNumber: string | null; gender: string | null };
    result: {
        subjects: ReportCardSubject[]; missing: { classSubjectId: string; subjectName: string }[];
        totalScore: number | null; averageScore: number | null; subjectsCounted: number;
        overallGrade: { grade: string; remark: string; isPass: boolean } | null; position: number | null; outOf: number;
    };
    attendance: { marked: number; present: number; absent: number; late: number; excused: number } | null;
}
/** GET /report-cards rows. `stale` is only present for staff. */
export interface ReportCardListItem {
    id: string; status: ReportCardStatus; student: { id: string; name: string; admissionNumber: string | null }; class: { id: string; name: string } | null;
    term: { id: string; name: string; session: string }; totalScore: number | null; averageScore: number | null; position: number | null; outOf: number | null;
    subjects: number; missingSubjects: number; publishedAt: string | null; stale?: boolean;
}
/** GET /report-cards/:id. Staff also get unpublishReason, stale, staleReason and a full `can`; families get can: { download }. */
export interface ReportCardDetail extends Omit<ReportCardListItem, "subjects" | "missingSubjects"> {
    teacherRemark: string | null; principalRemark: string | null; generatedAt: string | null; snapshot: ReportCardSnapshot | null;
    unpublishReason?: string | null; stale?: boolean; staleReason?: string | null;
    can: { download: boolean; editRemark?: boolean; editPrincipalRemark?: boolean; regenerate?: boolean; publish?: boolean; unpublish?: boolean };
}
/** GET /report-cards/overview?classId&termId */
export interface ClassOverview {
    class: { id: string; name: string }; term: { id: string; name: string; session: string };
    subjects: { published: number; total: number; list: { classSubjectId: string; name: string; published: boolean }[] };
    students: { student: { id: string; name: string; admissionNumber: string | null }; live: { averageScore: number | null; position: number | null; subjects: number };
        card: { id: string; status: ReportCardStatus; stale: boolean; hasTeacherRemark: boolean; hasPrincipalRemark: boolean } | null }[];
    counts: { students: number; noCard: number; draft: number; published: number; stale: number };
    can: { generate: boolean; publish: boolean };
}
export interface GenerateReportCardsResult {
    classId: string; termId: string; created: number; updated: number; skipped: { studentId: string; reason: "not_on_class_list" | "already_published" }[];
    subjects: { published: number; total: number; missing: string[] };
}
export interface PublishOutcome { id: string; ok: boolean; reason?: "not_found" | "already_published" | "not_generated" | "stale" | "blocked" | "not_published"; detail?: string[] }
export interface PublishReportCardsResult { published: number; guardiansTold: number; notifyError: string | null; results: PublishOutcome[] }
export interface UnpublishReportCardsResult { unpublished: number; results: PublishOutcome[] }

/** ?template= on GET /report-cards/:id/preview, /:id/pdf and /template-preview (staff only; families always get the school's own template) */
export const ReportCardTemplateKeys = ["classic", "modern", "minimal", "custom_letterhead"] as const;
export type ReportCardTemplateKey = (typeof ReportCardTemplateKeys)[number];
export const ReportCardTemplateQuery = z.object({ template: z.enum(ReportCardTemplateKeys).optional() });
export type ReportCardTemplateQuery = z.infer<typeof ReportCardTemplateQuery>;

/** GET /report-cards/templates: the picker. Save the choice with the existing School Settings call (reportCardTemplate). */
export interface ReportCardTemplateOption { key: ReportCardTemplateKey; name: string; description: string; current: boolean; available: boolean; unavailableReason: string | null }
/**
 * GET /report-cards/:id/preview and GET /report-cards/template-preview: the page as data, to show in
 * <iframe sandbox srcDoc={html} /> (an iframe cannot send the login header, so it is not a URL). It is the same markup the PDF is printed from.
 * `fellBack` is true when the saved template is no longer available (for example after a plan downgrade) and classic was used.
 */
export interface ReportCardPreview { template: ReportCardTemplateKey; fellBack: boolean; html: string }
