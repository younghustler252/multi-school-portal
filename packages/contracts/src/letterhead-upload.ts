/*
| POST /school-settings/letterhead   multipart/form-data, ONE file in the field "letterhead"
| Needs school_settings.manage AND the plan feature report_cards.letterhead (check entitlements["report_cards.letterhead"] in
| GET /users/me/permissions to show or hide the control).
| The file must really be a PNG, JPEG or WebP picture (read from its first bytes, not from the label the browser sends), at most 5 MB.
| Success: the updated school settings (SchoolSettings) with the new reportCardLetterheadUrl. Choosing the "custom_letterhead" report-card
| template is still a separate PUT /school-settings.
| Errors: 400 FILE_MISSING (no file, or a different field name), 400 IMAGE_EMPTY, 400 IMAGE_TOO_LARGE, 400 IMAGE_TYPE_NOT_ALLOWED,
|         403 FEATURE_NOT_AVAILABLE (plan), 403 permission, 401.
| Full contract: docs/api/contract-additions/letterhead-and-school-billing.md
*/
export const LETTERHEAD_FIELD = "letterhead";
export const LETTERHEAD_MAX_BYTES = 5 * 1024 * 1024;
export const LETTERHEAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LetterheadErrorCode = "FILE_MISSING" | "IMAGE_EMPTY" | "IMAGE_TOO_LARGE" | "IMAGE_TYPE_NOT_ALLOWED" | "FEATURE_NOT_AVAILABLE";
