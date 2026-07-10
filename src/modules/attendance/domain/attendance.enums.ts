/*
|--------------------------------------------------------------------------
| ATTENDANCE DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum AttendanceStatus {
    PRESENT = "present",
    ABSENT  = "absent",
    LATE    = "late",
    EXCUSED = "excused",
}

export enum AttendanceErrorMessage {
    NOT_FOUND          = "Attendance record not found",
    ALREADY_MARKED     = "Attendance already marked for this student today",
    STUDENT_NOT_FOUND  = "Student not found",
    TERM_NOT_FOUND     = "Term not found",
}