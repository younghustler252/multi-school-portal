/*
|--------------------------------------------------------------------------
| TEMPLATE ENGINE (pure: no database, no clock)
|
| A message is text with {{placeholders}}. Only the placeholders a template's catalog entry lists are allowed, so a school
| can never pull data the message was not meant to carry. Rendering is ONE pass: a value that itself contains "{{x}}" is
| never expanded again. For email the whole result is HTML-escaped (the template text AND the values: a student's name
| can hold anything), then split into paragraphs. SMS and in-app text stay plain text.
|--------------------------------------------------------------------------
*/
export type MessageChannel = "IN_APP" | "EMAIL" | "SMS";

export const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
export const VALUE_MAX_LENGTH = 200;

export const BODY_MAX: Record<MessageChannel, number> = { IN_APP: 1000, EMAIL: 5000, SMS: 480 };
export const SUBJECT_MAX = 120;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const placeholdersIn = (text: string): string[] => [...new Set([...text.matchAll(PLACEHOLDER)].map(m => m[1]))];

export const escapeHtml = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface TemplateText { subject?: string | null; body: string }

/** Problems with a template somebody is saving (empty means it is fine). */
export function validateTemplateText(channel: MessageChannel, t: TemplateText, allowed: readonly string[]): string[] {
    const problems: string[] = [];
    const body = (t.body ?? "").trim();
    const subject = (t.subject ?? "").trim();

    if (!body) problems.push("The message cannot be empty");
    if (body.length > BODY_MAX[channel]) problems.push(`The message is too long for ${channel === "SMS" ? "SMS" : channel === "EMAIL" ? "email" : "an in-app message"}: at most ${BODY_MAX[channel]} characters`);

    if (channel === "SMS") {
        if (subject) problems.push("An SMS has no subject");
    } else {
        if (!subject) problems.push("A subject is needed");
        if (subject.length > SUBJECT_MAX) problems.push(`The subject is too long: at most ${SUBJECT_MAX} characters`);
        if (/[\r\n]/.test(subject)) problems.push("The subject must be one line");
    }

    const unknown = [...new Set([...placeholdersIn(body), ...placeholdersIn(subject)])].filter(p => !allowed.includes(p));
    if (unknown.length) problems.push(`Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map(u => `{{${u}}}`).join(", ")}. Allowed: ${allowed.map(a => `{{${a}}}`).join(", ")}`);

    const stripped = `${body}\n${subject}`.replace(PLACEHOLDER, "");
    if (stripped.includes("{{") || stripped.includes("}}")) problems.push("A placeholder is not written correctly. Use {{name}} with the name in lowercase");

    return problems;
}

const cleanValue = (v: unknown): string => String(v ?? "").replace(CONTROL, " ").trim().slice(0, VALUE_MAX_LENGTH);

/** One pass: each placeholder becomes its value (or nothing when the value is missing). */
export function fillPlaceholders(text: string, values: Record<string, unknown>): { text: string; missing: string[] } {
    const missing = new Set<string>();
    const out = text.replace(PLACEHOLDER, (_all, name: string) => {
        if (!Object.prototype.hasOwnProperty.call(values, name) || values[name] === null || values[name] === undefined) { missing.add(name); return ""; }
        return cleanValue(values[name]);
    });
    return { text: out, missing: [...missing] };
}

export interface RenderedMessage {
    channel:    MessageChannel;
    subject:    string | null;
    /** Plain text for IN_APP and SMS; HTML-safe text for EMAIL (already escaped). */
    body:       string;
    /** EMAIL only: the body as escaped paragraphs, ready for the letter template. */
    paragraphs: string[];
    missing:    string[];
}

export function renderMessage(channel: MessageChannel, t: TemplateText, values: Record<string, unknown>): RenderedMessage {
    const body = fillPlaceholders((t.body ?? "").trim(), values);
    const subject = channel === "SMS" ? null : fillPlaceholders((t.subject ?? "").trim(), values);
    const missing = [...new Set([...body.missing, ...(subject?.missing ?? [])])];

    if (channel === "EMAIL") {
        const safe = escapeHtml(body.text);
        const paragraphs = safe.split(/\n{2,}/).map(p => p.trim().replace(/\n/g, "<br>")).filter(Boolean);
        return { channel, subject: subject ? subject.text : null, body: safe, paragraphs, missing };
    }
    return { channel, subject: subject ? subject.text : null, body: body.text, paragraphs: [], missing };
}

/* ---------- SMS length: how many messages will the school pay for ---------- */

const GSM_BASIC = new Set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà");
const GSM_EXTENDED = new Set("^{}\\[~]|€");

export function smsLength(text: string): { characters: number; encoding: "GSM-7" | "UCS-2"; segments: number } {
    const chars = [...text];
    const gsm = chars.every(c => GSM_BASIC.has(c) || GSM_EXTENDED.has(c));
    if (gsm) {
        const units = chars.reduce((n, c) => n + (GSM_EXTENDED.has(c) ? 2 : 1), 0);
        return { characters: chars.length, encoding: "GSM-7", segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153) };
    }
    const units = text.length;   // UTF-16 code units, what the phone counts
    return { characters: chars.length, encoding: "UCS-2", segments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67) };
}
