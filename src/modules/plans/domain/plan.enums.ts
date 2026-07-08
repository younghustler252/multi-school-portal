/*
|--------------------------------------------------------------------------
| PLAN ENUMS
|--------------------------------------------------------------------------
*/

export enum PlanName {
    FREE     = "Free",
    STARTER  = "Starter",
    STANDARD = "Standard",
    PREMIUM  = "Premium",
}

export enum PlanErrorMessage {
    NOT_FOUND        = "Plan not found",
    NAME_TAKEN       = "A plan with this name already exists",
    CANNOT_DELETE    = "Cannot delete a plan with active subscriptions",
    INVALID_LIMIT    = "Student or staff limit must be -1 (unlimited) or a positive number",
}

export enum PlanSuccessMessage {
    CREATED  = "Plan created successfully",
    UPDATED  = "Plan updated successfully",
    DELETED  = "Plan deleted successfully",
    SEEDED   = "Default plans seeded successfully",
}