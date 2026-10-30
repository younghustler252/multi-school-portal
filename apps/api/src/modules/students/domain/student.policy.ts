// Admission numbers look like 2026/0001 (the counter restarts every year).
// (When a settings service exists this becomes the setting `academic.admission_number_pattern`.)
export const ADMISSION_NUMBER_SEQUENCE = "students.admission_number";

/** The year used for numbering, in Nigerian time (so 1 January at 00:30 is already the new year). */
export const admissionYear = (d: Date = new Date()): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric" }).format(d);

export const formatAdmissionNumber = (year: string, n: number): string => `${year}/${String(n).padStart(4, "0")}`;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_ADMISSION_TRIES = 100;

// Photos are private. The database keeps the file's storage path; a short-lived link is made each time a student is read.
export const PHOTO_URL_TTL_SECONDS = 3600;
export const photoFolder = (schoolId: string): string => `students/${schoolId}/photos`;
/** True only for a path this school's photo upload created (a safety check before deleting a file). */
export const isOwnPhotoPath = (schoolId: string, value: string | null | undefined): value is string =>
    !!value && value.startsWith(`${photoFolder(schoolId)}/`) && !value.includes("..");
