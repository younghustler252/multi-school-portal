import { ReportCardTemplateData } from "./classic.template";

export function renderMinimalTemplate(data: ReportCardTemplateData): string {
    const rows = data.subjects.map(s => `
        <tr>
            <td>${s.subjectName}</td>
            <td>${s.caScore ?? "-"}</td>
            <td>${s.examScore ?? "-"}</td>
            <td>${s.total ?? "-"}</td>
            <td>${s.grade ?? "-"}</td>
        </tr>
    `).join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <style>
        body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 32px; }
        .header { text-align: center; border-bottom: 1px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; }
        .header p { margin: 3px 0; font-size: 11px; color: #555; }
        .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        th { border-bottom: 1px solid #1a1a1a; text-align: left; padding: 6px 8px; font-weight: normal; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        td { border-bottom: 1px solid #eee; padding: 6px 8px; }
        .summary { display: flex; justify-content: space-between; font-size: 12px; padding-top: 10px; border-top: 1px solid #1a1a1a; margin-bottom: 24px; }
        .remarks p { font-size: 12px; margin: 6px 0; font-style: italic; }
        .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
        .signatures div { text-align: center; font-size: 10px; }
        .signatures img { height: 32px; display: block; margin: 0 auto 4px; }
        .signatures .line { border-top: 1px solid #1a1a1a; width: 140px; margin-top: 28px; padding-top: 4px; }
    </style>
    </head>
    <body>
        <div class="header">
            <h1>${data.school.name}</h1>
            ${data.school.motto ? `<p>${data.school.motto}</p>` : ""}
            <p>Terminal Report — ${data.sessionName}, ${data.termName}</p>
        </div>

        <div class="meta">
            <span>${data.student.firstName} ${data.student.lastName}</span>
            <span>${data.className}</span>
            <span>${data.student.admissionNumber ?? "-"}</span>
        </div>

        <table>
            <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>

        <div class="summary">
            <span>Total: ${data.totalScore}</span>
            <span>Average: ${data.averageScore}%</span>
            <span>Position: ${data.position ?? "-"} / ${data.totalStudents ?? "-"}</span>
        </div>

        <div class="remarks">
            ${data.teacherRemark ? `<p>${data.teacherRemark}</p>` : ""}
            ${data.principalRemark ? `<p>${data.principalRemark}</p>` : ""}
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