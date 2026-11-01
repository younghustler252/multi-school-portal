/*
|--------------------------------------------------------------------------
| REPORT CARD HTML (one renderer, four themes)
| The same markup is used for the on-screen PREVIEW and for the PDF, so what the admin picks is what gets printed.
| Themes only change the look (colours, header, borders): every theme shows the same data.
| SAFETY: every piece of text is HTML-escaped; images must be https (or are left out); colours must be hex (or fall back).
| Nothing here reads the database or the clock.
|--------------------------------------------------------------------------
*/
export const REPORT_CARD_TEMPLATES = ["classic", "modern", "minimal", "custom_letterhead"] as const;
export type ReportCardTemplateName = typeof REPORT_CARD_TEMPLATES[number];

export interface ReportCardSubjectRow {
    subjectName: string;
    teacher?:    string | null;
    parts:       Array<{ position: number; name: string; maxScore: number; score: number | null; absent: boolean }>;
    total:       number | null;
    grade:       string | null;
    remark:      string | null;
    isPass:      boolean | null;
    position:    number | null;
    outOf:       number | null;
}

export interface ReportCardTemplateData {
    school:  { name: string; logoUrl: string | null; motto: string | null; address: string | null };
    student: { firstName: string; lastName: string; admissionNumber: string | null; photoUrl: string | null; gender: string | null };
    className: string; sessionName: string; termName: string;
    subjects: ReportCardSubjectRow[];
    missingSubjects: string[];
    totalScore: number | null; averageScore: number | null;
    overallGrade: { grade: string; remark: string } | null;
    position: number | null; totalStudents: number | null;
    attendance: { marked: number; present: number; absent: number; late: number; excused: number } | null;
    teacherRemark: string | null; principalRemark: string | null;
    branding: { primaryColor: string; secondaryColor: string | null; stampUrl: string | null; signatureUrl: string | null };
    letterhead?: { imageUrl: string; contentTopMm: number; contentBottomMm: number };
    /** Shown as a faint DRAFT mark across the page (a card that is not published yet). */
    draft?: boolean;
}

export const esc = (v: unknown): string => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** https images only (everything the app uploads is served from https). Anything else is dropped. */
export const safeImage = (u: string | null | undefined): string | null => {
    if (!u) return null;
    try { const url = new URL(u); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
};
export const safeColor = (c: string | null | undefined, fallback: string): string => (c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback);
export const ordinal = (n: number | null): string => {
    if (n === null || n === undefined) return "-";
    const v = n % 100; if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};
const num = (n: number | null | undefined): string => (n === null || n === undefined ? "-" : String(Math.round(n * 100) / 100));
const full = (s: ReportCardTemplateData["student"]): string => `${s.firstName} ${s.lastName}`.trim();

interface Theme { accent: string; soft: string; css: string; letterhead?: boolean }

function themeFor(name: ReportCardTemplateName, d: ReportCardTemplateData): Theme {
    const accent = safeColor(d.branding.primaryColor, name === "classic" ? "#299447" : "#1a1a2e");
    const soft = safeColor(d.branding.secondaryColor, name === "classic" ? "#e8f5ec" : "#f1f2f6");
    if (name === "modern") return { accent, soft, css: `
        .header{background:var(--accent);color:#fff;padding:18px 22px;border-radius:12px;margin-bottom:6px}
        .school-name{color:#fff}.motto,.address{color:#ffffffcc}.title .label{background:#ffffff26;color:#fff}.title .term{color:#ffffffcc}
        .logo{background:#fff;border-radius:12px;padding:4px}
        th{background:var(--accent);color:#fff}.summary .cell b{color:var(--accent)}
        .box h4{color:var(--accent)}` };
    if (name === "minimal") return { accent: "#111111", soft: "#f6f6f6", css: `
        body{font-family:Georgia,"Times New Roman",serif}
        .header{border-bottom:1px solid #111;padding-bottom:12px}.school-name{color:#111;font-weight:600}
        th{background:#fff;color:#111;border-bottom:1.5px solid #111;border-top:1.5px solid #111}
        td{border-bottom:1px solid #ddd}.badge{background:none;border:1px solid #111;color:#111}
        .box{border:1px solid #ccc;border-radius:0}.summary{border:1px solid #111;border-radius:0}.summary .cell b{color:#111}` };
    if (name === "custom_letterhead") return { accent, soft, letterhead: true, css: `
        .header{display:none}th{background:var(--accent);color:#fff}.summary .cell b{color:var(--accent)}
        .page{padding-top:var(--top);padding-bottom:var(--bottom)}` };
    return { accent, soft, css: `
        .page{border:1px solid #dcebe1;border-radius:14px;padding:22px}
        .header{border-bottom:2px solid var(--accent);padding-bottom:16px}
        th{background:var(--soft);color:var(--accent)}.summary .cell b{color:var(--accent)}` };
}

export function renderReportCardHtml(name: ReportCardTemplateName, d: ReportCardTemplateData): string {
    const t = themeFor(name, d);
    const logo = safeImage(d.school.logoUrl), stamp = safeImage(d.branding.stampUrl), sign = safeImage(d.branding.signatureUrl);
    const bg = t.letterhead && d.letterhead ? safeImage(d.letterhead.imageUrl) : null;
    const top = d.letterhead?.contentTopMm ?? 50, bottom = d.letterhead?.contentBottomMm ?? 30;

    // Columns for the parts of the score: one per position, named from the first subject that has it
    const cols = new Map<number, { name: string; max: number }>();
    for (const s of d.subjects) for (const p of s.parts) if (!cols.has(p.position)) cols.set(p.position, { name: p.name, max: p.maxScore });
    const colList = [...cols.entries()].sort((a, b) => a[0] - b[0]);

    const head = `<tr><th class="l">Subject</th>${colList.map(([, c]) => `<th>${esc(c.name)}<small>/${num(c.max)}</small></th>`).join("")}<th>Total</th><th>Grade</th><th>Pos.</th><th class="l">Remark</th></tr>`;
    const rows = d.subjects.map((s, i) => {
        const cells = colList.map(([pos]) => { const p = s.parts.find(x => x.position === pos); return `<td>${p ? (p.absent ? "ABS" : num(p.score)) : "-"}</td>`; }).join("");
        const failed = s.isPass === false;
        return `<tr><td class="l subj"><span class="n">${i + 1}</span>${esc(s.subjectName)}</td>${cells}<td class="tot${failed ? " fail" : ""}">${num(s.total)}</td>` +
            `<td><span class="badge${failed ? " fail" : ""}">${esc(s.grade ?? "-")}</span></td><td>${s.position ? `${ordinal(s.position)}${s.outOf ? `<small>/${s.outOf}</small>` : ""}` : "-"}</td><td class="l rem">${esc(s.remark ?? "-")}</td></tr>`;
    }).join("");
    const span = colList.length + 5;
    const missing = d.missingSubjects.length ? `<tr><td class="l miss" colspan="${span}">Not yet available: ${d.missingSubjects.map(esc).join(", ")}</td></tr>` : "";
    const a = d.attendance;
    const attendance = a && a.marked > 0 ? `<div class="att"><b>Attendance</b> ${a.present + a.late} of ${a.marked} days present` + (a.absent ? `, ${a.absent} absent` : "") + (a.late ? `, ${a.late} late` : "") + (a.excused ? `, ${a.excused} excused` : "") + `</div>` : "";

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@page{size:A4;margin:10mm}
:root{--accent:${t.accent};--soft:${t.soft};--top:${t.letterhead ? top : 0}mm;--bottom:${t.letterhead ? bottom : 0}mm}
*{box-sizing:border-box}
body{margin:0;color:#1f2a24;font:12px/1.5 Inter,-apple-system,"Segoe UI",Arial,sans-serif;position:relative}
${bg ? `body::before{content:"";position:fixed;inset:-10mm;background:url("${esc(bg)}") center/100% 100% no-repeat;z-index:-1}` : ""}
.page{position:relative;padding:12px}
.header{display:flex;align-items:center;gap:14px}
.logo{width:64px;height:64px;object-fit:contain;flex-shrink:0}
.info{flex:1}.school-name{margin:0;font-size:21px;line-height:1.2;color:var(--accent)}
.motto{margin:3px 0 0;font-style:italic;color:#5b6b63;font-size:11px}.address{margin:2px 0 0;color:#74847b;font-size:10px}
.title{text-align:right;flex-shrink:0}.title .label{display:inline-block;padding:4px 10px;border-radius:99px;background:var(--soft);color:var(--accent);font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}
.title .term{margin-top:4px;font-size:10px;color:#6b7d74}
.student{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0 10px}
.student div{background:var(--soft);border-radius:8px;padding:7px 10px}.student small{display:block;color:#6b7d74;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.student b{font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:6px}
th,td{padding:6px 7px;text-align:center;font-size:11px}th{font-size:10px;font-weight:700}th small{font-weight:400;opacity:.75;margin-left:2px}
th.l,td.l{text-align:left}td{border-bottom:1px solid #e6ece8}tr{page-break-inside:avoid}
.subj .n{display:inline-block;width:18px;color:#8a9a92}.tot{font-weight:700}.fail{color:#c0392b}
.badge{display:inline-block;min-width:24px;padding:1px 7px;border-radius:99px;background:var(--soft);color:var(--accent);font-weight:700}.badge.fail{background:#fdecea;color:#c0392b}
.rem{color:#4a5a52;font-size:10.5px}.miss{color:#8a6d1d;background:#fff8e1;font-size:10.5px}
.summary{display:grid;grid-template-columns:repeat(4,1fr);margin:12px 0 8px;border:1px solid #dfe7e2;border-radius:10px;overflow:hidden}
.summary .cell{padding:9px 12px;border-right:1px solid #dfe7e2}.summary .cell:last-child{border-right:0}
.summary small{display:block;color:#6b7d74;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.summary b{font-size:16px}
.att{margin:6px 0;color:#4a5a52}
.remarks{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.box{border:1px solid #dfe7e2;border-radius:8px;padding:8px 10px;min-height:60px}.box h4{margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#4a5a52}.box p{margin:0;white-space:pre-wrap}
.sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;gap:20px}
.sign .line{flex:1;text-align:center;border-top:1px solid #9aa9a1;padding-top:4px;font-size:10px;color:#4a5a52;min-height:46px;position:relative}
.sign img{max-height:44px;max-width:150px;display:block;margin:0 auto 2px}.stamp{max-height:70px!important}
.watermark{position:fixed;top:42%;left:0;right:0;text-align:center;font-size:120px;font-weight:800;color:#00000010;transform:rotate(-24deg);letter-spacing:12px;pointer-events:none}
${t.css}
</style></head><body>
${d.draft ? `<div class="watermark">DRAFT</div>` : ""}
<div class="page">
<div class="header">${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}<div class="info"><h1 class="school-name">${esc(d.school.name)}</h1>${d.school.motto ? `<p class="motto">${esc(d.school.motto)}</p>` : ""}${d.school.address ? `<p class="address">${esc(d.school.address)}</p>` : ""}</div>
<div class="title"><span class="label">Terminal Report Card</span><div class="term">${esc(d.termName)} · ${esc(d.sessionName)}</div></div></div>
<div class="student"><div><small>Student</small><b>${esc(full(d.student))}</b></div><div><small>Admission no.</small><b>${esc(d.student.admissionNumber ?? "-")}</b></div><div><small>Class</small><b>${esc(d.className)}</b></div><div><small>Position in class</small><b>${d.position ? `${ordinal(d.position)} of ${d.totalStudents ?? "-"}` : "-"}</b></div></div>
<table><thead>${head}</thead><tbody>${rows || `<tr><td class="l" colspan="${span}">No results yet</td></tr>`}${missing}</tbody></table>
<div class="summary"><div class="cell"><small>Total score</small><b>${num(d.totalScore)}</b></div><div class="cell"><small>Average</small><b>${num(d.averageScore)}</b></div><div class="cell"><small>Overall grade</small><b>${d.overallGrade ? esc(d.overallGrade.grade) : "-"}</b>${d.overallGrade ? ` <small style="display:inline">${esc(d.overallGrade.remark)}</small>` : ""}</div><div class="cell"><small>Position</small><b>${d.position ? ordinal(d.position) : "-"}</b></div></div>
${attendance}
<div class="remarks"><div class="box"><h4>Class teacher's remark</h4><p>${esc(d.teacherRemark ?? "")}</p></div><div class="box"><h4>Principal's remark</h4><p>${esc(d.principalRemark ?? "")}</p></div></div>
<div class="sign"><div class="line">Class teacher</div><div class="line">${sign ? `<img src="${esc(sign)}" alt="">` : ""}Principal</div>${stamp ? `<div><img class="stamp" src="${esc(stamp)}" alt=""></div>` : ""}</div>
</div></body></html>`;
}

/** What the template picker shows (the frontend lists these and calls the preview with the key). */
export const TEMPLATE_CATALOG: ReadonlyArray<{ key: ReportCardTemplateName; name: string; description: string; requiresFeature: string | null }> = [
    { key: "classic",           name: "Classic",           description: "Soft green accents, rounded card. A safe default.", requiresFeature: null },
    { key: "modern",            name: "Modern",            description: "Bold colour header in your school colour.", requiresFeature: null },
    { key: "minimal",           name: "Minimal",           description: "Black and white, serif type, thin lines. Prints well on any printer.", requiresFeature: null },
    { key: "custom_letterhead", name: "Your letterhead",   description: "Prints on your own letterhead image (set it in School Settings).", requiresFeature: "report_cards.letterhead" },
];
