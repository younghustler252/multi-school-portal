import { z } from "zod";

/*
| LINKS THE PLATFORM SHOWS TO PEOPLE (terms, privacy policy).
| Only https links, no embedded login (user:pass@), a sensible length. Nothing else gets through: not javascript:,
| data:, ftp:, or plain http. Empty text means "clear it". Use `nullableHttpsUrl()` in a DTO; use `isSafeHttpUrl` to
| double-check a value that is already stored before showing it.
*/
export const MAX_URL_LENGTH = 2048;

export function isHttpsUrl(value: string): boolean {
    if (value.length > MAX_URL_LENGTH) return false;
    try {
        const u = new URL(value);
        return u.protocol === "https:" && !u.username && !u.password && u.hostname.length > 0;
    } catch { return false; }
}

/** For values already in the database: http(s) only (http allowed so a local/dev storage link still shows). */
export function isSafeHttpUrl(value: string): boolean {
    if (value.length > MAX_URL_LENGTH) return false;
    try {
        const u = new URL(value);
        return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
    } catch { return false; }
}

/** An https link, or null to clear it. "" and spaces-only count as clear. Left out = leave it alone. */
export const nullableHttpsUrl = () => z.preprocess(
    v => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v),
    z.string().max(MAX_URL_LENGTH).refine(isHttpsUrl, "Must be an https:// link").nullable().optional(),
);
