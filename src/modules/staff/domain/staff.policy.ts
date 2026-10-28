// Employee numbers look like STF-0001. (When a settings service exists this becomes the setting `staff.employee_id_pattern`.)
export const EMPLOYEE_ID_SEQUENCE = "staff.employee_id";
export const EMPLOYEE_ID_PREFIX   = "STF";
export const formatEmployeeId = (n: number): string => `${EMPLOYEE_ID_PREFIX}-${String(n).padStart(4, "0")}`;

export const EXPORT_MAX_ROWS = 5000;

/** How many numbers to try before giving up (hand-typed ids can be in the way). */
export const MAX_EMPLOYEE_ID_TRIES = 100;
