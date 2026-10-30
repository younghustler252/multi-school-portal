/*
|--------------------------------------------------------------------------
| GUARDIAN DOMAIN ENUMS
|--------------------------------------------------------------------------
*/
export enum GuardianErrorMessage {
    NOT_FOUND           = "Guardian not found",
    ALREADY_LINKED      = "This guardian is already linked to this student",
    NOT_LINKED          = "This guardian is not linked to this student",
    STUDENT_NOT_FOUND   = "Student not found",
    INVITE_ALREADY_SENT = "An invite has already been sent to this email",
}

export enum GuardianSuccessMessage {
    CREATED  = "Guardian created successfully",
    UPDATED  = "Guardian updated successfully",
    LINKED   = "Guardian linked to student successfully",
    UNLINKED = "Guardian unlinked from student successfully",
    INVITED  = "Guardian invited successfully",
}