/*
| School addresses come from the API (`school.url`). Follow them only when they are plain http(s) URLs:
| never javascript:, data:, or anything that is not a URL at all.
*/
export function isSafeSchoolUrl(url: unknown): url is string {
	if (typeof url !== "string") return false;
	try {
		const u = new URL(url);
		return u.protocol === "https:" || u.protocol === "http:";
	} catch {
		return false;
	}
}
