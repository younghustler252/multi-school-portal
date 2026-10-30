/*
|--------------------------------------------------------------------------
| ENROLMENT DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum EnrolmentErrorMessage {
    NOT_FOUND          = "Enrolment not found",
    ALREADY_ENROLLED   = "Student is already enrolled in a class this term",
    STUDENT_NOT_FOUND  = "Student not found",
    CLASS_NOT_FOUND    = "Class not found",
    TERM_NOT_FOUND     = "Term not found",
    CLASS_FULL         = "This class has reached its maximum capacity",
}

export enum EnrolmentStatus {
    ACTIVE      = "active",
    WITHDRAWN   = "withdrawn",
    TRANSFERRED = "transferred",
    COMPLETED   = "completed",
}