import type { ApiResponse } from "@/types/api-response";

/*
| The backend's upload endpoints do NOT return `{ url }`. They return the UPDATED record, and the new file's address is
| one field of it (verified against the API, 2026-11-13):
|   POST /schools/me/logo             -> the school            (logoUrl)
|   POST /school-settings/stamp       -> the school settings   (stamp)
|   POST /school-settings/signature   -> the school settings   (signature)
|   POST /platform/settings/logo      -> the platform settings (logoUrl)   [endpoint not built yet]
| Each call site names which field it wants, so the real shape is typed at the edge and the rest of the UI can keep
| working with "the new address".
*/
export function uploadedUrl<T>(res: ApiResponse<T>, pick: (record: T) => string | null | undefined): ApiResponse<{ url: string }> {
	if (!res.success) return res;
	const url = pick(res.data);
	if (!url) return { success: false, message: "The upload finished but the server did not return the file address." };
	return { ...res, data: { url } };
}
