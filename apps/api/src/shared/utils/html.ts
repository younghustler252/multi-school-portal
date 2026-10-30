/* HTML helpers shared by everything that puts text into an email. Text is stored and shown as plain text everywhere;
   it is escaped only at the moment it goes into HTML (the email channel), so no module has to remember to do it. */
export const escapeHtml = (text: string): string =>
    String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Plain text to escaped paragraphs: a blank line starts a new paragraph, a single newline is a line break. */
export const textToParagraphs = (text: string): string[] =>
    escapeHtml(text).split(/\n{2,}/).map(p => p.trim().replace(/\n/g, "<br>")).filter(Boolean);

/** A header-safe single line (subjects): no line breaks, no control characters. */
export const singleLine = (text: string): string =>
    String(text ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
