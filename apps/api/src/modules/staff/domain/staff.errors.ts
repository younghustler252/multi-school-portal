import { AppError, NotFoundError, ConflictError, ForbiddenError, BadRequestError } from "../../../shared/errors/domain.errors";

/* The only place the staff module builds domain errors. Codes are stable; the frontend switches on them. */
export const staffErrors = {
    notFound:        () => new NotFoundError("Staff member"),
    emailTaken:      () => new ConflictError("A staff member with this email already exists"),
    employeeIdTaken: () => new ConflictError("A staff member with this employee ID already exists"),
    employeeIdFailed: () => new AppError("Could not create an employee ID. Please try again", 409, true, "EMPLOYEE_ID_FAILED"),
    possibleDuplicate: (id: string) => new AppError(
        "A staff member with the same name and phone already exists. If this is a different person, confirm and try again",
        409, true, "POSSIBLE_DUPLICATE_STAFF", { existingStaffId: id }),
    selfAction:      (what: string) => new BadRequestError(`You cannot ${what} your own staff record`),
    lastAdmin:       () => new AppError("This is the school's only administrator. Make someone else an administrator first", 409, true, "LAST_ADMINISTRATOR"),
    hasAssignments:  (n: number) => new AppError(
        `This staff member still has ${n} class or subject assignment(s). Reassign them first`, 409, true, "STAFF_HAS_ASSIGNMENTS", { assignments: n }),
    notPortalUser:   () => new AppError("This staff member has no portal account yet. Invite them first", 409, true, "NOT_A_PORTAL_USER"),
    alreadyHasAccess: () => new ConflictError("This staff member already has portal access"),
    noEmail:         () => new AppError("Add an email address for this staff member before inviting them", 400, true, "STAFF_HAS_NO_EMAIL"),
    inactive:        () => new ConflictError("This staff member is not active"),
    alreadyActive:   () => new ConflictError("This staff member is already active"),
    alreadyInactive: () => new ConflictError("This staff member is already inactive"),
    outOfScope:      () => new ForbiddenError("This staff member is outside your branch", "BRANCH_FORBIDDEN"),
    branchesInvalid: () => new AppError("One or more branches do not exist or are inactive", 400, true, "INVALID_BRANCHES"),
    branchOutOfScope: () => new ForbiddenError("You can only use your own branches", "BRANCH_FORBIDDEN"),
    rolesInvalid:    () => new AppError("One or more roles do not exist or are not staff roles", 400, true, "INVALID_ROLES"),
    ownRole:         () => new ForbiddenError("You cannot change your own role", "CANNOT_CHANGE_OWN_ROLE"),
    roleNotAllowed:  () => new ForbiddenError("You cannot grant a role with more access than you hold", "ROLE_NOT_ALLOWED"),
};
