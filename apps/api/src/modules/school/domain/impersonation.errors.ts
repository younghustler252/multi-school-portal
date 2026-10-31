import { AppError, ForbiddenError, NotFoundError } from "../../../shared/errors/domain.errors";

export const impersonationErrors = {
    schoolNotFound:  () => new NotFoundError("School"),
    notReady:        (why: string) => new AppError(`This school cannot be entered right now: ${why}`, 409, true, "IMPERSONATION_SCHOOL_NOT_READY"),
    actorNotAllowed: () => new ForbiddenError("Only active platform staff can enter a school", "IMPERSONATION_ACTOR_INVALID"),
    noTarget:        () => new AppError("No active school administrator was found to enter as", 404, true, "IMPERSONATION_NO_TARGET"),
    badTarget:       (why: string) => new AppError(`That person cannot be entered as: ${why}`, 422, true, "IMPERSONATION_TARGET_INVALID"),
};
