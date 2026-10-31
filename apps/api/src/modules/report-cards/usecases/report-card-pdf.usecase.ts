import type { Access } from "../../../foundation/access.service";
import type { ISchoolRepository } from "../../school/repositories/school.repository";
import type { ISchoolSettingsRepository } from "../../school-settings/repositories/school-settings.repository";
import type { PdfGeneratorService } from "../../../infrastructure/pdf/pdf-generator.service";
import type { ReportCardTemplateData } from "../../../infrastructure/pdf/templates/classic.template";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, snapshotOf } from "../repositories/card-table";
import { cardsViewWhere } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { CardSnapshot } from "../domain/report-card.policy";

interface Dependencies {
    reportCardsRepository: ReportCardsRepository; schoolRepository: ISchoolRepository;
    schoolSettingsRepository: ISchoolSettingsRepository; pdfGeneratorService: PdfGeneratorService;
}

/** What the PDF templates show, taken ONLY from the frozen snapshot and the remarks (never from live sheets). */
export function templateDataFor(snap: CardSnapshot, remarks: { teacherRemark: string | null; principalRemark: string | null }, school: ReportCardTemplateData["school"], branding: ReportCardTemplateData["branding"], letterhead?: ReportCardTemplateData["letterhead"]): ReportCardTemplateData {
    const r = snap.result;
    return {
        school, student: { firstName: snap.student.firstName, lastName: snap.student.lastName, admissionNumber: snap.student.admissionNumber, photoUrl: null, gender: snap.student.gender },
        className: snap.class.name, sessionName: snap.session, termName: snap.term,
        subjects: r.subjects.map(s => ({ subjectName: s.subjectName, caScore: s.ca, examScore: s.exam, total: s.total, grade: s.grade, remark: s.remark })),
        totalScore: r.totalScore ?? 0, averageScore: r.averageScore ?? 0, position: r.position, totalStudents: r.outOf || null,
        teacherRemark: remarks.teacherRemark, principalRemark: remarks.principalRemark, branding, letterhead,
    };
}

/*
| THE PDF of one report card. Needs report_cards.view for that card (families: only once it is published) and the plan feature
| report_cards.pdf (checked on the route). Drawn from the frozen snapshot, so a published card always prints exactly what families saw.
*/
export class ReportCardPdfUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, access: Access): Promise<{ buffer: Buffer; filename: string }> {
        const row = await this.d.reportCardsRepository.cards.findFirst({ where: { AND: [{ id }, cardsViewWhere(access)] }, include: CARD_INCLUDE });
        if (!row) throw reportCardErrors.notFound();
        const snap = snapshotOf(row);
        if (!snap) throw reportCardErrors.noPdf();

        const [school, settings] = await Promise.all([this.d.schoolRepository.findById(schoolId), this.d.schoolSettingsRepository.find()]);
        const data = templateDataFor(
            snap, { teacherRemark: row.teacherRemark, principalRemark: row.principalRemark },
            { name: school?.name ?? "School", logoUrl: school?.logoUrl ?? null, motto: settings?.motto ?? null, address: settings?.address ?? null },
            { primaryColor: settings?.primaryColor ?? "#1a1a2e", secondaryColor: settings?.secondaryColor ?? null, stampUrl: settings?.stamp ?? null, signatureUrl: settings?.signature ?? null },
            settings?.reportCardTemplate === "custom_letterhead" && settings.reportCardLetterheadUrl
                ? { imageUrl: settings.reportCardLetterheadUrl, contentTopMm: settings.letterheadContentTopMm ?? 50, contentBottomMm: settings.letterheadContentBottomMm ?? 30 } : undefined,
        );
        const buffer = await this.d.pdfGeneratorService.generateReportCardPdf(settings?.reportCardTemplate ?? "classic", data);
        const safe = `${snap.student.firstName}-${snap.student.lastName}-${snap.term}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return { buffer, filename: `${safe || "report-card"}.pdf` };
    }
}
