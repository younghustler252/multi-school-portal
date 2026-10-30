import { baseTemplate } from "./base.template";

/*
|--------------------------------------------------------------------------
| LETTER TEMPLATE
| General purpose template for any non-OTP email
| Used for: welcome, invite, subscription expiry, payment receipt,
|           school verified/rejected, suspension notice, announcements etc
|--------------------------------------------------------------------------
*/

export interface LetterButton {
    label: string;
    url:   string;
}

export interface LetterTemplateParams {
    subject:    string;
    title:      string;
    greeting?:  string;
    paragraphs: string[];
    button?:    LetterButton;
    footer?:    string;
    preheader?: string;
}

export const letterTemplate = (
    params: LetterTemplateParams,
): { subject: string; html: string } => {
    const paragraphsHtml = params.paragraphs
        .map(p => `<p>${p}</p>`)
        .join("\n");

    const buttonHtml = params.button ? `
        <div style="text-align: center; margin: 32px 0;">
            <a href="${params.button.url}" class="btn">
                ${params.button.label}
            </a>
        </div>
    ` : "";

    const footerHtml = params.footer ? `
        <hr class="divider" />
        <p style="font-size: 13px; color: #999;">${params.footer}</p>
    ` : "";

    const content = `
        <h2>${params.title}</h2>
        ${params.greeting ? `<p>${params.greeting}</p>` : ""}
        ${paragraphsHtml}
        ${buttonHtml}
        ${footerHtml}
    `;

    return {
        subject: params.subject,
        html:    baseTemplate({
            title:     params.subject,
            preheader: params.preheader,
            content,
        }),
    };
};