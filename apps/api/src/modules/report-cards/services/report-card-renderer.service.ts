import type { ISchoolRepository } from "../../school/repositories/school.repository";
import type { ISchoolSettingsRepository } from "../../school-settings/repositories/school-settings.repository";
import type { PdfGeneratorService } from "../../../infrastructure/pdf/pdf-generator.service";
import { ReportCardTemplateData, ReportCardTemplateName, REPORT_CARD_TEMPLATES, TEMPLATE_CATALOG } from "../../../infrastructure/pdf/report-card.html";
import { CardSnapshot } from "../domain/report-card.policy";
import { reportCardErrors } from "../domain/report-cards.errors";
import { PdfCacheService, pdfHash } from "./pdf-cache.service";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolSettingsRepository: ISchoolSettingsRepository; pdfGeneratorService: PdfGeneratorService;
    entitlementsService: { checkFeature(schoolId: string, key: string): Promise<{ allowed: boolean }> };
    allowedImageHosts: string[];
    pdfCacheService: PdfCacheService;
}
type Settings = Awaited<ReturnType<ISchoolSettingsRepository["find"]>>;

/** What the templates print, taken ONLY from the frozen snapshot and the remarks (never from live sheets). */
export function templateDataFor(
    snap: CardSnapshot, remarks: { teacherRemark: string | null; principalRemark: string | null }, ctx: Pick<ReportCardTemplateData, "school" | "branding" | "letterhead">, draft: boolean,
): ReportCardTemplateData {
    const r = snap.result;
    return {
        school: ctx.school, branding: ctx.branding, letterhead: ctx.letterhead, draft,
        student: { firstName: snap.student.firstName, lastName: snap.student.lastName, admissionNumber: snap.student.admissionNumber, photoUrl: null, gender: snap.student.gender },
        className: snap.class.name, sessionName: snap.session, termName: snap.term,
        subjects: r.subjects.map(s => ({ subjectName: s.subjectName, teacher: s.teacher, parts: s.parts, total: s.total, grade: s.grade, remark: s.remark, isPass: s.isPass, position: s.position, outOf: s.outOf })),
        missingSubjects: r.missing.map(m => m.subjectName),
        totalScore: r.totalScore, averageScore: r.averageScore, overallGrade: r.overallGrade ? { grade: r.overallGrade.grade, remark: r.overallGrade.remark } : null,
        position: r.position, totalStudents: r.outOf || null, attendance: snap.attendance,
        teacherRemark: remarks.teacherRemark, principalRemark: remarks.principalRemark,
    };
}

/** A realistic example for the template picker (the school's own name, logo and colours, a made-up student). */
export function sampleData(ctx: Pick<ReportCardTemplateData, "school" | "branding" | "letterhead">): ReportCardTemplateData {
    const names = ["Mathematics", "English Language", "Basic Science", "Social Studies", "Civic Education", "Computer Studies", "Agricultural Science", "Christian Religious Studies"];
    const scores: Array<[number, number]> = [[36, 52], [31, 49], [34, 55], [29, 44], [33, 50], [38, 57], [27, 38], [30, 41]];
    const grade = (t: number) => (t >= 70 ? ["A", "Excellent"] : t >= 60 ? ["B", "Very good"] : t >= 50 ? ["C", "Good"] : ["D", "Fair"]);
    const subjects = names.map((n, i) => {
        const [ca, ex] = scores[i]; const total = ca + ex; const [g, remark] = grade(total);
        return { subjectName: n, teacher: null, parts: [{ position: 1, name: "CA", maxScore: 40, score: ca, absent: false }, { position: 2, name: "Exam", maxScore: 60, score: ex, absent: false }], total, grade: g, remark, isPass: true, position: (i % 5) + 1, outOf: 32 };
    });
    const totalScore = subjects.reduce((n, s) => n + s.total, 0);
    return {
        ...ctx, draft: false,
        student: { firstName: "Tolu", lastName: "Adeyemi", admissionNumber: "ADM/2026/014", photoUrl: null, gender: "female" },
        className: "JSS 2", sessionName: "2026/2027", termName: "First Term",
        subjects, missingSubjects: [], totalScore, averageScore: Math.round((totalScore / subjects.length) * 100) / 100,
        overallGrade: { grade: "B", remark: "Very good" }, position: 4, totalStudents: 32,
        attendance: { marked: 60, present: 56, absent: 3, late: 1, excused: 0 },
        teacherRemark: "Tolu is hardworking and polite. Keep it up.", principalRemark: "A very good result. Well done.",
    };
}

/*
| Turns a card (or a sample) into HTML or a PDF with the right template.
| Which template: the one asked for (staff only) or the school's own setting. The letterhead template needs a letterhead image AND the plan feature
| report_cards.letterhead: asked for explicitly without them it is refused with a reason; saved as the default but no longer available (plan
| downgrade) it quietly falls back to classic so printing never stops.
*/
export class ReportCardRenderer {
    constructor(private readonly d: Dependencies) {}

    private async context(schoolId: string) {
        const [school, settings] = await Promise.all([this.d.schoolRepository.findById(schoolId), this.d.schoolSettingsRepository.find()]);
        const ctx: Pick<ReportCardTemplateData, "school" | "branding" | "letterhead"> = {
            school: { name: school?.name ?? "School", logoUrl: school?.logoUrl ?? null, motto: settings?.motto ?? null, address: settings?.address ?? null },
            branding: { primaryColor: settings?.primaryColor ?? "#299447", secondaryColor: settings?.secondaryColor ?? null, stampUrl: settings?.stamp ?? null, signatureUrl: settings?.signature ?? null },
            letterhead: settings?.reportCardLetterheadUrl ? { imageUrl: settings.reportCardLetterheadUrl, contentTopMm: settings.letterheadContentTopMm ?? 50, contentBottomMm: settings.letterheadContentBottomMm ?? 30 } : undefined,
        };
        const brandingVersion = {
            schoolUpdatedAt: (school as { updatedAt?: Date | null } | null)?.updatedAt ?? null,
            settingsUpdatedAt: (settings as { updatedAt?: Date | null } | null)?.updatedAt ?? null,
        };
        return { ctx, settings, brandingVersion };
    }

    private async letterheadProblem(schoolId: string, settings: Settings): Promise<string | null> {
        if (!settings?.reportCardLetterheadUrl) return "Upload your letterhead in School Settings first";
        if (!(await this.d.entitlementsService.checkFeature(schoolId, "report_cards.letterhead")).allowed) return "Your plan does not include a custom letterhead";
        return null;
    }

    async resolve(schoolId: string, requested: string | undefined, settings: Settings): Promise<{ name: ReportCardTemplateName; fellBack: boolean }> {
        const saved = settings?.reportCardTemplate as string | undefined;
        const wanted = (requested ?? saved ?? "classic") as string;
        const name = (REPORT_CARD_TEMPLATES as readonly string[]).includes(wanted) ? (wanted as ReportCardTemplateName) : "classic";
        if (name === "custom_letterhead") {
            const problem = await this.letterheadProblem(schoolId, settings);
            if (problem) { if (requested) throw reportCardErrors.templateUnavailable(problem); return { name: "classic", fellBack: true }; }
        }
        return { name, fellBack: false };
    }

    async cardHtml(schoolId: string, snap: CardSnapshot, remarks: { teacherRemark: string | null; principalRemark: string | null }, draft: boolean, requested?: string) {
        const { ctx, settings } = await this.context(schoolId);
        const t = await this.resolve(schoolId, requested, settings);
        return { template: t.name, fellBack: t.fellBack, data: templateDataFor(snap, remarks, ctx, draft) };
    }

    /**
     * Render (or return cached) a single card PDF.
     * @param schoolId  needed for the cache folder path
     * @param termId    needed for the cache folder path
     * @param cardId    needed for the cache folder path
     */
    async cardPdf(
        schoolId: string, termId: string, cardId: string,
        snap: CardSnapshot, remarks: { teacherRemark: string | null; principalRemark: string | null },
        draft: boolean, requested?: string,
    ): Promise<{ buffer: Buffer; cached: boolean }> {
        const { ctx, settings, brandingVersion } = await this.context(schoolId);
        const t = await this.resolve(schoolId, requested, settings);
        const data = templateDataFor(snap, remarks, ctx, draft);
        const hash = pdfHash(t.name, data, brandingVersion);
        const folder = `schools/${schoolId}/report-cards/${termId}/single/${cardId}`;
        return this.d.pdfCacheService.getSingle(folder, hash, () =>
            this.d.pdfGeneratorService.generateReportCardPdf(t.name, data, this.d.allowedImageHosts),
        );
    }

    /**
     * Render (or return cached) a whole-class PDF.
     * @param schoolId   cache folder
     * @param termId     cache folder
     * @param classId    cache folder
     * @param items      rows to include: snap + remarks for each card
     */
    async classPdf(
        schoolId: string, termId: string, classId: string,
        items: Array<{ snap: CardSnapshot; remarks: { teacherRemark: string | null; principalRemark: string | null } }>,
        requested?: string,
    ): Promise<{ buffer: Buffer; cached: boolean }> {
        const { ctx, settings, brandingVersion } = await this.context(schoolId);
        const t = await this.resolve(schoolId, requested, settings);
        const dataList = items.map(({ snap, remarks }) => templateDataFor(snap, remarks, ctx, false /* class PDF = published only = not draft */));
        const hash = pdfHash(t.name, dataList, brandingVersion);
        const folder = `schools/${schoolId}/report-cards/${termId}/classes/${classId}`;
        return this.d.pdfCacheService.getClass(folder, hash, () =>
            this.d.pdfGeneratorService.generateReportCardsPdf(t.name, dataList, this.d.allowedImageHosts),
        );
    }

    html(template: ReportCardTemplateName, data: ReportCardTemplateData): string { return this.d.pdfGeneratorService.html(template, data); }

    async sample(schoolId: string, requested?: string) {
        const { ctx, settings } = await this.context(schoolId);
        const t = await this.resolve(schoolId, requested, settings);
        return { template: t.name, fellBack: t.fellBack, data: sampleData(ctx) };
    }

    /** The picker: every template, whether this school can use it right now and why not, and which one is saved. */
    async templates(schoolId: string) {
        const { settings } = await this.context(schoolId);
        const saved = (settings?.reportCardTemplate as string | undefined) ?? "classic";
        const letterheadProblem = await this.letterheadProblem(schoolId, settings);
        return TEMPLATE_CATALOG.map(t => ({
            key: t.key, name: t.name, description: t.description, current: t.key === saved,
            available: t.key === "custom_letterhead" ? letterheadProblem === null : true,
            unavailableReason: t.key === "custom_letterhead" ? letterheadProblem : null,
        }));
    }
}
