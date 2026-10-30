export enum ActorType {
    USER        = "user",
    SYSTEM      = "system",
    SUPER_ADMIN = "super_admin",
    WEBHOOK     = "webhook",
}

export enum AuditAction {
    // Auth
    USER_LOGIN           = "user.login",
    USER_LOGOUT          = "user.logout",
    USER_REGISTER        = "user.register",
    USER_PASSWORD_RESET  = "user.password_reset",
    USER_PASSWORD_CHANGE = "user.password_change",

    // School
    SCHOOL_CREATED       = "school.created",
    SCHOOL_UPDATED       = "school.updated",
    SCHOOL_VERIFIED      = "school.verified",
    SCHOOL_REJECTED      = "school.rejected",
    SCHOOL_SUSPENDED     = "school.suspended",
    SCHOOL_ACTIVATED     = "school.activated",

    // Staff
    STAFF_CREATED        = "staff.created",
    STAFF_UPDATED        = "staff.updated",
    STAFF_DEACTIVATED    = "staff.deactivated",

    // Student
    STUDENT_CREATED      = "student.created",
    STUDENT_UPDATED      = "student.updated",
    STUDENT_DEACTIVATED  = "student.deactivated",

    // Enrolment
    STUDENT_ENROLLED     = "student.enrolled",
    STUDENT_WITHDRAWN    = "student.withdrawn",

    // Grades
    GRADE_ENTERED        = "grade.entered",
    GRADE_PUBLISHED      = "grade.published",

    // Fees
    INVOICE_CREATED      = "invoice.created",
    PAYMENT_RECORDED     = "payment.recorded",
    PAYMENT_CONFIRMED    = "payment.confirmed",

    // Plans
    PLAN_UPGRADED        = "subscription.upgraded",
    PLAN_CANCELLED       = "subscription.cancelled",
}