import { AppError, NotFoundError, ConflictError, ForbiddenError } from "../../../shared/errors/domain.errors";

export const branchErrors = {
    notFound:      () => new NotFoundError("Branch"),
    nameTaken:     () => new ConflictError("A branch with this name already exists"),
    codeTaken:     () => new ConflictError("A branch with this code already exists"),
    mainProtected: (what: string) => new AppError(`The main branch cannot be ${what}`, 409, true, "MAIN_BRANCH_PROTECTED"),
    inUse:         (n: number) => new AppError(
        `${n} active member(s) are still assigned to this branch. Move them to another branch first`, 409, true, "BRANCH_IN_USE", { members: n }),
    notDeactivated: () => new ConflictError("Deactivate the branch before deleting it"),
    principalInvalid: () => new AppError("The selected principal must be an active staff member", 400, true, "INVALID_PRINCIPAL"),
    membershipInvalid: () => new AppError("Only active staff members can be assigned to branches", 400, true, "INVALID_MEMBERSHIP"),
    branchesInvalid:  () => new AppError("One or more branches do not exist or are inactive", 400, true, "INVALID_BRANCHES"),
    notYourBranch:    () => new ForbiddenError("You do not have access to this branch", "BRANCH_FORBIDDEN"),
};
