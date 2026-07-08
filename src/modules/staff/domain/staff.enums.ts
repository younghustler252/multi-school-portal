/*
|--------------------------------------------------------------------------
| STAFF DOMAIN ENUMS
|--------------------------------------------------------------------------
*/

export enum StaffErrorMessage {
    NOT_FOUND          = "Staff member not found",
    EMPLOYEE_ID_TAKEN  = "A staff member with this employee ID already exists",
    USER_ALREADY_STAFF = "This user is already a staff member",
    CANNOT_DELETE_SELF = "You cannot delete your own staff record",
}

export enum StaffSuccessMessage {
    CREATED    = "Staff member created successfully",
    UPDATED    = "Staff member updated successfully",
    DEACTIVATED = "Staff member deactivated successfully",
    ACTIVATED   = "Staff member activated successfully",
}