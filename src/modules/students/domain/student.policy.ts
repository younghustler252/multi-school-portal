// Admission numbers look like 2026/0001 (the counter restarts every year).
// (When a settings service exists this becomes the setting `academic.admission_number_pattern`.)
export const ADMISSION_NUMBER_SEQUENCE = "students.admission_number";

/** The year used for numbering, in Nigerian time (so 1 January at 00:30 is already the new year). */
export const admissionYear = (d: Date = new Date()): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric" }).format(d);

export const formatAdmissionNumber = (year: string, n: number): string => `${year}/${String(n).padStart(4, "0")}`;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_ADMISSION_TRIES = 100;
