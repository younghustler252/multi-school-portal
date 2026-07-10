/*
|--------------------------------------------------------------------------
| CLASS DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum ClassErrorMessage {
    NOT_FOUND              = "Class not found",
    NAME_TAKEN             = "A class with this name already exists",
    SUBJECT_NOT_FOUND      = "Subject not found",
    SUBJECT_CODE_TAKEN     = "A subject with this code already exists",
    ALREADY_ASSIGNED       = "This subject is already assigned to this class",
    STAFF_NOT_FOUND        = "Staff member not found",
    CLASS_SUBJECT_NOT_FOUND = "Class subject assignment not found",
}

export enum ClassSuccessMessage {
    CLASS_CREATED    = "Class created successfully",
    CLASS_UPDATED    = "Class updated successfully",
    CLASS_DELETED    = "Class deleted successfully",
    SUBJECT_CREATED  = "Subject created successfully",
    SUBJECT_UPDATED  = "Subject updated successfully",
    SUBJECT_ASSIGNED = "Subject assigned to class successfully",
    SUBJECT_REMOVED  = "Subject removed from class successfully",
}