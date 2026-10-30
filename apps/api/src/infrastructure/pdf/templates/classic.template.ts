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
    const primary = data.branding.primaryColor || "#299447";
    const secondary = data.branding.secondaryColor || "#e8f5ec";

    const rows = data.subjects
        .map(
            (s, index) => `
                <tr>
                    <td class="subject-cell">
                        <span class="subject-number">${index + 1}</span>
                        <span>${s.subjectName}</span>
                    </td>
                    <td>${s.caScore ?? "-"}</td>
                    <td>${s.examScore ?? "-"}</td>
                    <td class="total-cell">${s.total ?? "-"}</td>
                    <td>
                        <span class="grade-badge">${s.grade ?? "-"}</span>
                    </td>
                    <td class="remark-cell">${s.remark ?? "-"}</td>
                </tr>
            `,
        )
        .join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />

        <style>
            * {
                box-sizing: border-box;
            }

            @page {
                size: A4;
                margin: 14mm;
            }

            body {
                font-family:
                    Inter,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    Arial,
                    sans-serif;

                color: #183027;
                background: #f4faf6;
                margin: 0;
                padding: 0;
                font-size: 12px;
                line-height: 1.5;
            }

            .page {
                background: #ffffff;
                border: 1px solid #dcebe1;
                border-radius: 14px;
                overflow: hidden;
                padding: 24px;
            }

            /* ---------------------------------------------------------
             * HEADER
             * ------------------------------------------------------ */

            .header {
                display: flex;
                align-items: center;
                gap: 16px;
                padding-bottom: 18px;
                border-bottom: 2px solid ${primary};
            }

            .logo-wrapper {
                width: 68px;
                height: 68px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${secondary};
                border: 1px solid #d8eadf;
                border-radius: 12px;
                overflow: hidden;
            }

            .header img.logo {
                width: 54px;
                height: 54px;
                object-fit: contain;
            }

            .school-info {
                flex: 1;
            }

            .school-name {
                margin: 0;
                color: ${primary};
                font-size: 22px;
                font-weight: 750;
                line-height: 1.2;
                letter-spacing: -0.3px;
            }

            .school-motto {
                margin: 4px 0 0;
                color: #557065;
                font-size: 11px;
                font-style: italic;
            }

            .school-address {
                margin: 2px 0 0;
                color: #71847b;
                font-size: 10px;
            }

            .report-title {
                text-align: right;
                flex-shrink: 0;
            }

            .report-title .label {
                display: inline-block;
                padding: 5px 10px;
                border-radius: 999px;
                background: ${secondary};
                color: ${primary};
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.7px;
            }

            .report-title .term {
                margin-top: 5px;
                color: #6b7d74;
                font-size: 10px;
            }

            /* ---------------------------------------------------------
             * STUDENT INFORMATION
             * ------------------------------------------------------ */

            .student-section {
                margin-top: 20px;
            }

            .section-heading {
                margin-bottom: 8px;
                color: #28483c;
                font-size: 10px;
                font-weight: 750;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }

            .student-grid {
                display: grid;
                grid-template-columns: 1.7fr 1fr 0.8fr;
                gap: 8px;
            }

            .info-card {
                padding: 10px 12px;
                background: #f7fbf8;
                border: 1px solid #e1eee6;
                border-radius: 8px;
            }

            .info-label {
                display: block;
                margin-bottom: 2px;
                color: #84948c;
                font-size: 8px;
                font-weight: 650;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .info-value {
                color: #233d33;
                font-size: 11px;
                font-weight: 650;
            }

            /* ---------------------------------------------------------
             * ACADEMIC META
             * ------------------------------------------------------ */

            .academic-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 8px;
            }

            /* ---------------------------------------------------------
             * RESULTS
             * ------------------------------------------------------ */

            .results-section {
                margin-top: 20px;
            }

            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                overflow: hidden;
                border: 1px solid #dcebe1;
                border-radius: 9px;
                font-size: 10px;
            }

            th {
                padding: 9px 8px;
                background: ${primary};
                color: #ffffff;
                text-align: left;
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.35px;
                border: none;
            }

            th:first-child {
                border-top-left-radius: 8px;
            }

            th:last-child {
                border-top-right-radius: 8px;
            }

            td {
                padding: 8px;
                color: #40554c;
                border-top: 1px solid #e7f0ea;
                background: #ffffff;
                vertical-align: middle;
            }

            tbody tr:nth-child(even) td {
                background: #f8fbf9;
            }

            .subject-cell {
                display: flex;
                align-items: center;
                gap: 7px;
                color: #233d33;
                font-weight: 600;
            }

            .subject-number {
                display: inline-flex;
                width: 18px;
                height: 18px;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border-radius: 50%;
                background: ${secondary};
                color: ${primary};
                font-size: 8px;
                font-weight: 700;
            }

            .total-cell {
                color: #233d33;
                font-weight: 700;
            }

            .grade-badge {
                display: inline-flex;
                min-width: 25px;
                padding: 3px 6px;
                align-items: center;
                justify-content: center;
                border-radius: 5px;
                background: ${secondary};
                color: ${primary};
                font-size: 9px;
                font-weight: 750;
            }

            .remark-cell {
                color: #6b7d74;
                font-size: 9px;
            }

            /* ---------------------------------------------------------
             * SUMMARY
             * ------------------------------------------------------ */

            .summary {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-top: 14px;
            }

            .summary-card {
                position: relative;
                padding: 12px 14px;
                background: ${secondary};
                border: 1px solid #d5e9dc;
                border-radius: 9px;
            }

            .summary-card.primary {
                background: ${primary};
                border-color: ${primary};
                color: #ffffff;
            }

            .summary-label {
                display: block;
                margin-bottom: 2px;
                font-size: 8px;
                font-weight: 650;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.75;
            }

            .summary-value {
                font-size: 17px;
                font-weight: 750;
                line-height: 1.2;
            }

            /* ---------------------------------------------------------
             * REMARKS
             * ------------------------------------------------------ */

            .remarks {
                margin-top: 18px;
            }

            .remark-box {
                margin-top: 7px;
                padding: 10px 12px;
                background: #f8fbf9;
                border-left: 3px solid ${primary};
                border-radius: 0 7px 7px 0;
                color: #53675e;
                font-size: 10px;
            }

            .remark-box strong {
                color: #29473b;
            }

            /* ---------------------------------------------------------
             * SIGNATURES
             * ------------------------------------------------------ */

            .signatures {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 35px;
                margin-top: 30px;
                padding-top: 16px;
                border-top: 1px solid #e2ede6;
            }

            .signature {
                text-align: center;
                color: #71847b;
                font-size: 9px;
            }

            .signature img {
                height: 38px;
                max-width: 110px;
                object-fit: contain;
                display: block;
                margin: 0 auto 4px;
            }

            .signature-line {
                width: 130px;
                margin: 10px auto 4px;
                border-top: 1px solid #8ca097;
            }

            .signature-label {
                color: #52675d;
                font-weight: 600;
            }

            /* ---------------------------------------------------------
             * FOOTER
             * ------------------------------------------------------ */

            .footer {
                margin-top: 18px;
                padding-top: 9px;
                border-top: 1px solid #edf3ef;
                text-align: center;
                color: #9aaa a2;
                font-size: 8px;
            }
        </style>
    </head>

    <body>
        <div class="page">

            <!-- Header -->
            <div class="header">
                ${
                    data.school.logoUrl
                        ? `
                            <div class="logo-wrapper">
                                <img
                                    class="logo"
                                    src="${data.school.logoUrl}"
                                    alt="School logo"
                                />
                            </div>
                        `
                        : ""
                }

                <div class="school-info">
                    <h1 class="school-name">${data.school.name}</h1>

                    ${
                        data.school.motto
                            ? `<p class="school-motto">${data.school.motto}</p>`
                            : ""
                    }

                    ${
                        data.school.address
                            ? `<p class="school-address">${data.school.address}</p>`
                            : ""
                    }
                </div>

                <div class="report-title">
                    <span class="label">Academic Report</span>
                    <div class="term">
                        ${data.sessionName} · ${data.termName}
                    </div>
                </div>
            </div>

            <!-- Student Information -->
            <div class="student-section">
                <div class="section-heading">Student Information</div>

                <div class="student-grid">
                    <div class="info-card">
                        <span class="info-label">Student</span>
                        <span class="info-value">
                            ${data.student.firstName} ${data.student.lastName}
                        </span>
                    </div>

                    <div class="info-card">
                        <span class="info-label">Admission No.</span>
                        <span class="info-value">
                            ${data.student.admissionNumber ?? "-"}
                        </span>
                    </div>

                    <div class="info-card">
                        <span class="info-label">Class</span>
                        <span class="info-value">
                            ${data.className}
                        </span>
                    </div>
                </div>

                <div class="academic-grid">
                    <div class="info-card">
                        <span class="info-label">Session</span>
                        <span class="info-value">
                            ${data.sessionName}
                        </span>
                    </div>

                    <div class="info-card">
                        <span class="info-label">Term</span>
                        <span class="info-value">
                            ${data.termName}
                        </span>
                    </div>

                    <div class="info-card">
                        <span class="info-label">Position</span>
                        <span class="info-value">
                            ${
                                data.position != null
                                    ? `${data.position} of ${data.totalStudents ?? "-"}`
                                    : "-"
                            }
                        </span>
                    </div>
                </div>
            </div>

            <!-- Results -->
            <div class="results-section">
                <div class="section-heading">Academic Performance</div>

                <table>
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>CA</th>
                            <th>Exam</th>
                            <th>Total</th>
                            <th>Grade</th>
                            <th>Remark</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Summary -->
            <div class="summary">
                <div class="summary-card primary">
                    <span class="summary-label">Total Score</span>
                    <span class="summary-value">${data.totalScore}</span>
                </div>

                <div class="summary-card">
                    <span class="summary-label">Average Score</span>
                    <span class="summary-value">${data.averageScore}%</span>
                </div>
            </div>

            <!-- Remarks -->
            ${
                data.teacherRemark || data.principalRemark
                    ? `
                        <div class="remarks">
                            <div class="section-heading">Remarks</div>

                            ${
                                data.teacherRemark
                                    ? `
                                        <div class="remark-box">
                                            <strong>Teacher's Remark:</strong>
                                            ${data.teacherRemark}
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                data.principalRemark
                                    ? `
                                        <div class="remark-box">
                                            <strong>Principal's Remark:</strong>
                                            ${data.principalRemark}
                                        </div>
                                    `
                                    : ""
                            }
                        </div>
                    `
                    : ""
            }

            <!-- Signatures -->
            <div class="signatures">
                <div class="signature">
                    ${
                        data.branding.signatureUrl
                            ? `<img src="${data.branding.signatureUrl}" alt="Principal signature" />`
                            : ""
                    }

                    <div class="signature-line"></div>
                    <div class="signature-label">Principal's Signature</div>
                </div>

                <div class="signature">
                    ${
                        data.branding.stampUrl
                            ? `<img src="${data.branding.stampUrl}" alt="School stamp" />`
                            : ""
                    }

                    <div class="signature-line"></div>
                    <div class="signature-label">School Stamp</div>
                </div>
            </div>

            <div class="footer">
                Official academic report · ${data.school.name}
            </div>

        </div>
    </body>
    </html>
    `;
}
