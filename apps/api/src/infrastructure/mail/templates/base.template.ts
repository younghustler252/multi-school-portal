/*
|--------------------------------------------------------------------------
| BASE EMAIL TEMPLATE
| Branded wrapper used by all email templates
|--------------------------------------------------------------------------
*/

export const baseTemplate = (params: {
    title:       string;
    preheader?:  string;
    content:     string;
}): string => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${params.title}</title>
    <!--[if mso]>
    <noscript>
        <xml><o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings></xml>
    </noscript>
    <![endif]-->
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                         Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f5f5;
            color: #333333;
            line-height: 1.6;
        }
        .wrapper {
            width: 100%;
            background-color: #f5f5f5;
            padding: 40px 16px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #1a1a2e;
            padding: 24px 40px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .header span {
            color: #4f8ef7;
        }
        .body {
            padding: 40px;
        }
        .body h2 {
            font-size: 20px;
            color: #1a1a2e;
            margin-bottom: 16px;
        }
        .body p {
            font-size: 15px;
            color: #555555;
            margin-bottom: 16px;
        }
        .btn {
            display: inline-block;
            background-color: #1a1a2e;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 15px;
            margin: 8px 0 24px;
        }
        .code-box {
            background-color: #f4f4f4;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
        }
        .code-box span {
            font-size: 38px;
            font-weight: 700;
            letter-spacing: 10px;
            color: #1a1a2e;
        }
        .divider {
            border: none;
            border-top: 1px solid #eeeeee;
            margin: 24px 0;
        }
        .footer {
            background-color: #f9f9f9;
            padding: 24px 40px;
            text-align: center;
            border-top: 1px solid #eeeeee;
        }
        .footer p {
            font-size: 12px;
            color: #999999;
            margin-bottom: 4px;
        }
        .footer a {
            color: #4f8ef7;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .body { padding: 24px 20px; }
            .header { padding: 20px; }
            .footer { padding: 20px; }
            .code-box span { font-size: 28px; letter-spacing: 6px; }
        }
    </style>
</head>
<body>
    ${params.preheader ? `
    <div style="display:none;max-height:0;overflow:hidden;color:#f5f5f5;">
        ${params.preheader}
    </div>` : ""}
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>School<span>Portal</span></h1>
            </div>
            <div class="body">
                ${params.content}
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} SchoolPortal. All rights reserved.</p>
                <p>
                    Need help?
                    <a href="mailto:support@schoolportal.com">support@schoolportal.com</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;