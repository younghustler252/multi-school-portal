import { ReportCardTemplateData } from "./classic.template";

export function renderCustomLetterheadTemplate(data: ReportCardTemplateData): string {
    if (!data.letterhead) {
        throw new Error("Letterhead data missing for custom_letterhead template");
    }

    const rows = data.subjects.map(s => `
        <tr>
            <td>${s.subjectName}</td>
            <td>${s.caScore ?? "-"}</td>
            <td>${s.examScore ?? "-"}</td>
            <td>${s.total ?? "-"}</td>
            <td>${s.grade ?? "-"}</td>
            <td>${s.remark ?? "-"}</td>
        </tr>
    `).join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <style>
        @page { margin: 0; }
        body {
            font-family: Arial, sans-serif;
            color: #1a1a1a;
            margin: 0;
            width: 210mm;
            min-height: 297mm;
            background-image: url('${data.letterhead.imageUrl}');
            background-size: 210mm 297mm;
            background-repeat: no-repeat;
        }
        .content {
            padding-top: ${data.letterhead.contentTopMm}mm;
            padding-bottom: ${data.letterhead.contentBottomMm}mm;
            padding-left: 15mm;
            padding-right: 15mm;
        }
        .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        th { background: rgba(0,0,0,0.05); padding: 6px 8px; text-align: left; }
        td { border: 1px solid rgba(0,0,0,0.15); padding: 5px 8px; }
        .summary { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; }
        .remarks p { font-size: 12px; margin: 4px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 24px; }
        .signatures div { text-align: center; font-size: 10px; }
        .signatures img { height: 32px; display: block; margin: 0 auto 4px; }
        .signatures .line { border-top: 1px solid #333; width: 130px; margin-top: 24px; padding-top: 4px; }
    </style>
    </head>
    <body>
        <div class="content">
            <div class="meta">
                <div><strong>${data.student.firstName} ${data.student.lastName}</strong></div>
                <div>${data.className}</div>
                <div>${data.sessionName}, ${data.termName}</div>
            </div>

            <table>
                <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Remark</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>

            <div class="summary">
                <span>Total: ${data.totalScore}</span>
                <span>Average: ${data.averageScore}%</span>
                <span>Position: ${data.position ?? "-"} / ${data.totalStudents ?? "-"}</span>
            </div>

            <div class="remarks">
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
        </div>
    </body>
    </html>
    `;
}