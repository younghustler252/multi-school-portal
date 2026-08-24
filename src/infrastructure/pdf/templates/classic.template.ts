export interface ReportCardTemplateData {
    school: {
        name:    string;
        logoUrl: string | null;
        motto:   string | null;
        address: string | null;
    };
    student: {
        firstName:       string;
        lastName:        string;
        admissionNumber: string | null;
        photoUrl:        string | null;
        gender:          string | null;
    };
    className:   string;
    sessionName: string;
    termName:    string;
    subjects: Array<{
        subjectName: string;
        caScore:     number | null;
        examScore:   number | null;
        total:       number | null;
        grade:       string | null;
        remark:      string | null;
    }>;
    totalScore:      number;
    averageScore:    number;
    position:        number | null;
    totalStudents:   number | null;
    teacherRemark:   string | null;
    principalRemark: string | null;
    branding: {
        primaryColor:   string;
        secondaryColor: string | null;
        stampUrl:       string | null;
        signatureUrl:   string | null;
    };
    letterhead?: {
        imageUrl:         string;
        contentTopMm:     number;
        contentBottomMm:  number;
    };
}

export function renderClassicTemplate(data: ReportCardTemplateData): string {
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
        body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
        .header { display: flex; align-items: center; border-bottom: 3px solid ${data.branding.primaryColor}; padding-bottom: 16px; margin-bottom: 20px; }
        .header img.logo { width: 64px; height: 64px; object-fit: contain; margin-right: 16px; }
        .header h1 { margin: 0; font-size: 22px; color: ${data.branding.primaryColor}; }
        .header p { margin: 2px 0; font-size: 12px; color: #555; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
        .meta div { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background: ${data.branding.primaryColor}; color: #fff; padding: 8px; text-align: left; }
        td { border: 1px solid #ddd; padding: 6px 8px; }
        .summary { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px; }
        .remarks { font-size: 13px; margin-bottom: 24px; }
        .remarks p { margin: 4px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .signatures div { text-align: center; font-size: 11px; }
        .signatures img { height: 40px; display: block; margin: 0 auto 4px; }
        .signatures .line { border-top: 1px solid #333; width: 150px; margin-top: 30px; padding-top: 4px; }
    </style>
    </head>
    <body>
        <div class="header">
            ${data.school.logoUrl ? `<img class="logo" src="${data.school.logoUrl}" />` : ""}
            <div>
                <h1>${data.school.name}</h1>
                ${data.school.motto ? `<p><em>${data.school.motto}</em></p>` : ""}
                ${data.school.address ? `<p>${data.school.address}</p>` : ""}
            </div>
        </div>

        <div class="meta">
            <div><strong>Student:</strong> ${data.student.firstName} ${data.student.lastName}</div>
            <div><strong>Admission No:</strong> ${data.student.admissionNumber ?? "-"}</div>
            <div><strong>Class:</strong> ${data.className}</div>
        </div>
        <div class="meta">
            <div><strong>Session:</strong> ${data.sessionName}</div>
            <div><strong>Term:</strong> ${data.termName}</div>
            <div><strong>Position:</strong> ${data.position ?? "-"} of ${data.totalStudents ?? "-"}</div>
        </div>

        <table>
            <thead>
                <tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Remark</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div class="summary">
            <div><strong>Total Score:</strong> ${data.totalScore}</div>
            <div><strong>Average:</strong> ${data.averageScore}%</div>
        </div>

        <div class="remarks">
            ${data.teacherRemark ? `<p><strong>Teacher's Remark:</strong> ${data.teacherRemark}</p>` : ""}
            ${data.principalRemark ? `<p><strong>Principal's Remark:</strong> ${data.principalRemark}</p>` : ""}
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