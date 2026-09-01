import { ReportCardTemplateData } from "./classic.template";

export function renderMinimalTemplate(data: ReportCardTemplateData): string {
    const primary = data.branding.primaryColor || "#299447";
    const secondary = data.branding.secondaryColor || "#e8f5ec";

    const rows = data.subjects
        .map(
            (s, index) => `
                <tr>
                    <td class="subject">
                        <span class="number">${index + 1}</span>
                        <span>${s.subjectName}</span>
                    </td>
                    <td>${s.caScore ?? "-"}</td>
                    <td>${s.examScore ?? "-"}</td>
                    <td class="total">${s.total ?? "-"}</td>
                    <td>
                        <span class="grade">${s.grade ?? "-"}</span>
                    </td>
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

                color: #24382f;
                background: #f5faf7;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.5;
            }

            .page {
                background: #ffffff;
                border: 1px solid #dfece4;
                border-radius: 12px;
                padding: 26px;
            }

            /* ---------------------------------------------------------
             * HEADER
             * ------------------------------------------------------ */

            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                padding-bottom: 18px;
                border-bottom: 1px solid #dce9e1;
            }

            .school {
                display: flex;
                align-items: center;
                gap: 13px;
                min-width: 0;
            }

            .logo-wrapper {
                width: 54px;
                height: 54px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                background: ${secondary};
                border: 1px solid #d8e9de;
                overflow: hidden;
            }

            .logo {
                width: 43px;
                height: 43px;
                object-fit: contain;
            }

            .school-info h1 {
                margin: 0;
                color: #20382d;
                font-size: 19px;
                font-weight: 750;
                line-height: 1.2;
                letter-spacing: -0.2px;
            }

            .school-info p {
                margin: 3px 0 0;
                color: #71847a;
                font-size: 9px;
            }

            .report-info {
                flex-shrink: 0;
                text-align: right;
            }

            .report-label {
                display: inline-block;
                padding: 4px 9px;
                border-radius: 999px;
                background: ${secondary};
                color: ${primary};
                font-size: 8px;
                font-weight: 750;
                text-transform: uppercase;
                letter-spacing: 0.7px;
            }

            .report-term {
                margin-top: 5px;
                color: #788980;
                font-size: 9px;
            }

            /* ---------------------------------------------------------
             * STUDENT DETAILS
             * ------------------------------------------------------ */

            .student-info {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr;
                gap: 8px;
                margin-top: 18px;
            }

            .info {
                padding: 9px 11px;
                border: 1px solid #e3eee7;
                background: #fafcfb;
                border-radius: 7px;
            }

            .info-label {
                display: block;
                margin-bottom: 2px;
                color: #87978f;
                font-size: 7px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.55px;
            }

            .info-value {
                color: #294238;
                font-size: 10px;
                font-weight: 650;
            }

            /* ---------------------------------------------------------
             * RESULTS
             * ------------------------------------------------------ */

            .results {
                margin-top: 22px;
            }

            .section-title {
                margin-bottom: 8px;
                color: #60756b;
                font-size: 8px;
                font-weight: 750;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }

            table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                border: 1px solid #dfeae3;
                border-radius: 8px;
                overflow: hidden;
                font-size: 9px;
            }

            th {
                padding: 8px;
                background: #f4f9f6;
                color: #65786f;
                border-bottom: 1px solid #dfeae3;
                text-align: left;
                font-size: 7.5px;
                font-weight: 750;
                text-transform: uppercase;
                letter-spacing: 0.45px;
            }

            td {
                padding: 8px;
                background: #ffffff;
                color: #52665c;
                border-bottom: 1px solid #edf3ef;
            }

            tbody tr:last-child td {
                border-bottom: none;
            }

            tbody tr:nth-child(even) td {
                background: #fbfdfc;
            }

            .subject {
                display: flex;
                align-items: center;
                gap: 7px;
                color: #30483d;
                font-weight: 600;
            }

            .number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 17px;
                height: 17px;
                flex-shrink: 0;
                border-radius: 50%;
                background: ${secondary};
                color: ${primary};
                font-size: 7px;
                font-weight: 750;
            }

            .total {
                color: #294238;
                font-weight: 700;
            }

            .grade {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 23px;
                padding: 3px 5px;
                border-radius: 4px;
                background: ${secondary};
                color: ${primary};
                font-size: 8px;
                font-weight: 750;
            }

            /* ---------------------------------------------------------
             * SUMMARY
             * ------------------------------------------------------ */

            .summary {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 12px;
            }

            .summary-item {
                padding: 10px 11px;
                border-radius: 7px;
                background: #f8fbf9;
                border: 1px solid #e2eee6;
            }

            .summary-item.highlight {
                background: ${primary};
                border-color: ${primary};
            }

            .summary-label {
                display: block;
                margin-bottom: 2px;
                color: #899990;
                font-size: 7px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.45px;
            }

            .summary-value {
                color: #2d463b;
                font-size: 13px;
                font-weight: 750;
            }

            .highlight .summary-label,
            .highlight .summary-value {
                color: #ffffff;
            }

            /* ---------------------------------------------------------
             * REMARKS
             * ------------------------------------------------------ */

            .remarks {
                margin-top: 18px;
            }

            .remark {
                margin-top: 6px;
                padding: 9px 11px;
                background: #fafcfb;
                border-left: 3px solid ${primary};
                border-radius: 0 6px 6px 0;
                color: #60736a;
                font-size: 9px;
            }

            .remark strong {
                color: #30483d;
            }

            .remark + .remark {
                margin-top: 5px;
            }

            /* ---------------------------------------------------------
             * SIGNATURES
             * ------------------------------------------------------ */

            .signatures {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 50px;
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #e7efe9;
            }

            .signature {
                text-align: center;
                color: #74857d;
                font-size: 8px;
            }

            .signature img {
                display: block;
                width: auto;
                height: 34px;
                max-width: 105px;
                object-fit: contain;
                margin: 0 auto 3px;
            }

            .signature-line {
                width: 125px;
                margin: 9px auto 4px;
                border-top: 1px solid #a6b4ad;
            }

            .signature-label {
                color: #52665c;
                font-weight: 600;
            }

            /* ---------------------------------------------------------
             * FOOTER
             * ------------------------------------------------------ */

            .footer {
                margin-top: 17px;
                padding-top: 8px;
                border-top: 1px solid #edf3ef;
                color: #9aaa a2;
                text-align: center;
                font-size: 7px;
            }
        </style>
    </head>

    <body>
        <div class="page">

            <!-- Header -->
            <div class="header">
                <div class="school">

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
                        <h1>${data.school.name}</h1>

                        ${
                            data.school.motto
                                ? `<p><em>${data.school.motto}</em></p>`
                                : ""
                        }

                        ${
                            data.school.address
                                ? `<p>${data.school.address}</p>`
                                : ""
                        }
                    </div>
                </div>

                <div class="report-info">
                    <span class="report-label">
                        Terminal Report
                    </span>

                    <div class="report-term">
                        ${data.sessionName} · ${data.termName}
                    </div>
                </div>
            </div>

            <!-- Student Information -->
            <div class="student-info">
                <div class="info">
                    <span class="info-label">Student</span>
                    <span class="info-value">
                        ${data.student.firstName} ${data.student.lastName}
                    </span>
                </div>

                <div class="info">
                    <span class="info-label">Class</span>
                    <span class="info-value">
                        ${data.className}
                    </span>
                </div>

                <div class="info">
                    <span class="info-label">Admission No.</span>
                    <span class="info-value">
                        ${data.student.admissionNumber ?? "-"}
                    </span>
                </div>
            </div>

            <!-- Results -->
            <div class="results">
                <div class="section-title">
                    Academic Performance
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>CA</th>
                            <th>Exam</th>
                            <th>Total</th>
                            <th>Grade</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Summary -->
            <div class="summary">

                <div class="summary-item highlight">
                    <span class="summary-label">
                        Total Score
                    </span>

                    <span class="summary-value">
                        ${data.totalScore}
                    </span>
                </div>

                <div class="summary-item">
                    <span class="summary-label">
                        Average
                    </span>

                    <span class="summary-value">
                        ${data.averageScore}%
                    </span>
                </div>

                <div class="summary-item">
                    <span class="summary-label">
                        Position
                    </span>

                    <span class="summary-value">
                        ${
                            data.position != null
                                ? `${data.position} / ${data.totalStudents ?? "-"}`
                                : "-"
                        }
                    </span>
                </div>

            </div>

            <!-- Remarks -->
            ${
                data.teacherRemark || data.principalRemark
                    ? `
                        <div class="remarks">
                            <div class="section-title">
                                Remarks
                            </div>

                            ${
                                data.teacherRemark
                                    ? `
                                        <div class="remark">
                                            <strong>Teacher:</strong>
                                            ${data.teacherRemark}
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                data.principalRemark
                                    ? `
                                        <div class="remark">
                                            <strong>Principal:</strong>
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
                            ? `
                                <img
                                    src="${data.branding.signatureUrl}"
                                    alt="Principal signature"
                                />
                            `
                            : ""
                    }

                    <div class="signature-line"></div>

                    <div class="signature-label">
                        Principal's Signature
                    </div>
                </div>

                <div class="signature">
                    ${
                        data.branding.stampUrl
                            ? `
                                <img
                                    src="${data.branding.stampUrl}"
                                    alt="School stamp"
                                />
                            `
                            : ""
                    }

                    <div class="signature-line"></div>

                    <div class="signature-label">
                        School Stamp
                    </div>
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