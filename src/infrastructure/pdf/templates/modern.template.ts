import { ReportCardTemplateData } from "./classic.template";

function gradeColor(grade: string | null): string {
    if (!grade) return "#9ca3af";
    if (["A1"].includes(grade)) return "#16a34a";
    if (["B2", "B3"].includes(grade)) return "#2563eb";
    if (["C4", "C5", "C6"].includes(grade)) return "#d97706";
    return "#dc2626";
}

export function renderModernTemplate(data: ReportCardTemplateData): string {
    const cards = data.subjects.map(s => `
        <div class="subject-card">
            <div class="subject-name">${s.subjectName}</div>
            <div class="subject-scores">
                <span>CA: ${s.caScore ?? "-"}</span>
                <span>Exam: ${s.examScore ?? "-"}</span>
                <span class="total">Total: ${s.total ?? "-"}</span>
            </div>
            <div class="grade-badge" style="background:${gradeColor(s.grade)}">${s.grade ?? "-"}</div>
            ${s.remark ? `<div class="remark">${s.remark}</div>` : ""}
        </div>
    `).join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .header img.logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 2px 0; font-size: 11px; color: #6b7280; }
        .info-strip { display: flex; gap: 24px; background: ${data.branding.primaryColor}10; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 12px; }
        .info-strip div span { display: block; color: #6b7280; font-size: 10px; text-transform: uppercase; }
        .grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
        .subject-card { flex: 1 1 45%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; position: relative; }
        .subject-name { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
        .subject-scores { display: flex; gap: 12px; font-size: 11px; color: #4b5563; }
        .subject-scores .total { font-weight: 600; color: #111827; }
        .grade-badge { position: absolute; top: 12px; right: 12px; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
        .remark { font-size: 10px; color: #6b7280; margin-top: 6px; }
        .summary-row { display: flex; gap: 16px; background: #111827; color: #fff; border-radius: 10px; padding: 14px 18px; font-size: 13px; margin-bottom: 20px; }
        .summary-row div span { display: block; font-size: 10px; opacity: 0.7; text-transform: uppercase; }
        .remarks-box { font-size: 12px; margin-bottom: 24px; }
        .remarks-box p { margin: 4px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 36px; }
        .signatures div { text-align: center; font-size: 10px; }
        .signatures img { height: 36px; display: block; margin: 0 auto 4px; }
        .signatures .line { border-top: 1px solid #d1d5db; width: 140px; margin-top: 28px; padding-top: 4px; }
    </style>
    </head>
    <body>
        <div class="header">
            ${data.school.logoUrl ? `<img class="logo" src="${data.school.logoUrl}" />` : ""}
            <div>
                <h1>${data.school.name}</h1>
                ${data.school.motto ? `<p>${data.school.motto}</p>` : ""}
            </div>
        </div>

        <div class="info-strip">
            <div><span>Student</span>${data.student.firstName} ${data.student.lastName}</div>
            <div><span>Class</span>${data.className}</div>
            <div><span>Session</span>${data.sessionName}</div>
            <div><span>Term</span>${data.termName}</div>
        </div>

        <div class="grid">${cards}</div>

        <div class="summary-row">
            <div><span>Total Score</span>${data.totalScore}</div>
            <div><span>Average</span>${data.averageScore}%</div>
            <div><span>Position</span>${data.position ?? "-"} of ${data.totalStudents ?? "-"}</div>
        </div>

        <div class="remarks-box">
            ${data.teacherRemark ? `<p><strong>Teacher:</strong> ${data.teacherRemark}</p>` : ""}
            ${data.principalRemark ? `<p><strong>Principal:</strong> ${data.principalRemark}</p>` : ""}
        </div>

        <div class="signatures">
            <div>
                ${data.branding.signatureUrl ? `<img src="${data.branding.signatureUrl}" />` : ""}
                <div class="line">Principal's Signature</div>
            </div>
            <div>
                ${data.branding.stampUrl ? `<img src="${data.branding.stampUrl}" />` : ""}
                <div class="line">School Stamp</div>
            </div>
        </div>
    </body>
    </html>
    `;
}