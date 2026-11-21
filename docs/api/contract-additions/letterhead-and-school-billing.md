# Letterhead upload and school billing history

## E. `POST /api/v1/school-settings/letterhead`
Types: `packages/contracts/src/letterhead-upload.ts`. School realm. `multipart/form-data`, one file in the field `letterhead`.

Guards, in order: authenticate, tenant, `school_settings.manage`, plan feature `report_cards.letterhead` (`403 FEATURE_NOT_AVAILABLE`), then the file is read. Permission and plan are checked **before** the upload is read.

- Accepts PNG, JPEG or WebP, **5 MB at most** (stamp and signature stay at 2 MB). The type is read from the first bytes (magic-byte check); the browser's label and file name are ignored.
- Stores the image in the public bucket under `schools/<schoolId>/letterhead/<uuid>.<ext>` and saves the URL as `reportCardLetterheadUrl`; the report-card renderer already reads that field, so no renderer change. Returns the updated school settings (`200`, "Letterhead uploaded successfully").
- Choosing the `custom_letterhead` template stays a separate `PUT /school-settings`. `reportCardLetterheadUrl` in `PUT /school-settings` still works (URL string); the upload route just removes the need to host the image elsewhere.
- Audit: `school_settings.letterhead_uploaded` with old and new URL.
- Errors: 400 `FILE_MISSING` (no file or wrong field name), `IMAGE_EMPTY`, `IMAGE_TOO_LARGE`, `IMAGE_TYPE_NOT_ALLOWED`; 403 permission or `FEATURE_NOT_AVAILABLE`; 401. Unlike `/stamp` and `/signature`, an oversize file returns a clean 400 `IMAGE_TOO_LARGE` instead of an unhandled multer error.
- Old letterhead files are not deleted from storage (same as stamp and signature).

### Is 5 MB safe? What I could and could not check
- Checked in code: there is no image-processing step (no resizing or re-encoding), the file is held in memory only for the request (multer memory storage, 5 MB), and Express's 10 MB JSON limit does not apply to multipart. The renderer loads the image by URL in headless Chrome, restricted to the storage host, with the existing render timeout.
- Not verifiable here: the storage bucket's own file-size limit, and PDF rendering time for bulk report cards with a 5 MB image. If bulk generation gets slow, the fix is to resize on upload, not to lower the cap silently.

## F. `GET /api/v1/platform/subscriptions/schools/:schoolId/invoices`
Types: `packages/contracts/src/school-billing-history.ts`. Platform realm, permission `platform.subscriptions.view`.

- Query: `page` (1), `limit` (20, max 100), `status` (`open|paid|void|uncollectible`). Ordered by due date, newest first (the all-schools list is oldest first, for chasing payment); ties broken by id.
- Items are the same `InvoiceResponseData` as `GET /platform/subscriptions/invoices`, minus `schoolId`, `schoolName`, `schoolSubdomain`. Paginated envelope with `meta { total, page, limit, totalPages, hasNext, hasPrev }`.
- Errors: 404 `School not found`, 400 invalid query, 401, 403.
- Reuses the existing invoice mapper; no second invoice implementation. The school's own billing screen (`/subscriptions` school realm) is unchanged.

Inventory: School settings 6 -> 7; School billing and platform subscription administration 22 -> 23; total 130 -> 132 (after the bank-lookup PR).
