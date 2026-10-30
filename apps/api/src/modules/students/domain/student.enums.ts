/*
|--------------------------------------------------------------------------
| STUDENT DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum StudentErrorMessage {
    NOT_FOUND              = "Student not found",
    ADMISSION_NUMBER_TAKEN = "A student with this admission number already exists",
    ALREADY_ENROLLED       = "Student is already enrolled in a class this term",
}

export enum StudentSuccessMessage {
    CREATED     = "Student created successfully",
    UPDATED     = "Student updated successfully",
    DEACTIVATED = "Student deactivated successfully",
    ACTIVATED   = "Student activated successfully",
}