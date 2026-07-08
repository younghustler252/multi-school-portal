/*
|--------------------------------------------------------------------------
| SCHOOL DOMAIN ENUMS
| Module-level constants and error messages
|--------------------------------------------------------------------------
*/

export enum SchoolErrorMessage {
    NOT_FOUND              = "School not found",
    SUBDOMAIN_TAKEN        = "This subdomain is already taken",
    EMAIL_TAKEN            = "A school with this email already exists",
    SCHEMA_NAME_TAKEN      = "Schema name already exists",
    NOT_ACTIVE             = "This school account is not active",
    NOT_VERIFIED           = "This school has not been verified yet",
    ALREADY_VERIFIED       = "This school is already verified",
    ALREADY_ACTIVE         = "This school is already active",
    SUSPENDED              = "This school account has been suspended",
    DOCUMENT_NOT_FOUND     = "Document not found",
    INVALID_STATUS         = "Invalid school status",
}

export enum SchoolSuccessMessage {
    CREATED                = "School registered successfully",
    UPDATED                = "School updated successfully",
    VERIFIED               = "School verified successfully",
    SUSPENDED              = "School suspended successfully",
    ACTIVATED              = "School activated successfully",
    DOCUMENT_UPLOADED      = "Document uploaded successfully",
    DOCUMENT_APPROVED      = "Document approved successfully",
    DOCUMENT_REJECTED      = "Document rejected successfully",
}