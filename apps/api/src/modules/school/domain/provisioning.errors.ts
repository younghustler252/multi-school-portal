import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

export const provisioningErrors = {
    notFound:    () => new NotFoundError("School"),
    already:     () => new AppError("This school is already provisioned", 409, true, "ALREADY_PROVISIONED"),
    inProgress:  (state: string) => new AppError("Provisioning is already in progress for this school", 409, true, "PROVISIONING_IN_PROGRESS", { state }),
};
