/*
|--------------------------------------------------------------------------
| GRADE DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum GradeErrorMessage {
    NOT_FOUND              = "Grade record not found",
    ALREADY_EXISTS         = "Grade already entered for this student and subject",
    NOT_PUBLISHED          = "Grades have not been published yet",
    GRADING_CONFIG_MISSING = "Grading configuration not found",
    CLASS_SUBJECT_NOT_FOUND = "Class subject assignment not found",
}