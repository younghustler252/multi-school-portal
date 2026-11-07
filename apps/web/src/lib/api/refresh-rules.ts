import { API_CODES } from "./api-error";
import type { SessionEndReason } from "./session-events";

/*
| Which failures the API client answers with "refresh and retry", which end the session, and which are left alone.
| Pure, so the rules are tested without axios.
*/

/*
| /auth/* calls that are never answered by "refresh and retry": a 401 there is the real answer
| (wrong password, bad OTP, dead refresh token). switch-persona and logout-all are the only /auth/ calls that need a session.
*/
export function isSessionlessAuthUrl(url: string | undefined): boolean {
	if (!url) return false;
	const path = url.split("?")[0];
	if (!path.startsWith("/auth/")) return false;
	return path !== "/auth/switch-persona" && path !== "/auth/logout-all";
}

// The access cookie lives exactly as long as the access token, so an expired session usually arrives as TOKEN_MISSING.
export function shouldRefreshFor(status: number | null, code: string): boolean {
	return status === 401 && (code === API_CODES.TOKEN_EXPIRED || code === API_CODES.TOKEN_MISSING);
}

// 401s where refreshing cannot help: the session itself is gone.
export function endsSession(status: number | null, code: string): SessionEndReason | null {
	if (code === API_CODES.TENANT_MISMATCH) return "tenant-mismatch";
	if (status === 401 && (code === API_CODES.TOKEN_INVALID || code === API_CODES.SESSION_INVALID)) return "invalid";
	return null;
}
