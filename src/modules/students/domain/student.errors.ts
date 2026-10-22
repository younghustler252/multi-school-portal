import { AppError, NotFoundError, ConflictError, BadRequestError } from "../../../shared/errors/domain.errors";

/* The only place the students module builds domain errors. Codes are stable; the frontend switches on them. */
export const studentErrors = {
    notFound:             () => new NotFoundError("Student"),
    admissionNumberTaken: () => new AppError("A student with this admission number already exists", 409, true, "ADMISSION_NUMBER_TAKEN"),
    admissionNumberFailed: () => new AppError("Could not create an admission number. Please try again", 409, true, "ADMISSION_NUMBER_FAILED"),
    possibleDuplicate:    (id: string) => new AppError(
        "A student with the same name and date of birth already exists. If this is a different child, confirm and try again",
        409, true, "POSSIBLE_DUPLICATE_STUDENT", { existingStudentId: id }),
    alreadyInactive:      () => new ConflictError("This student is already inactive"),
    alreadyActive:        () => new ConflictError("This student is already active"),
    nothingToUpdate:      () => new BadRequestError("Nothing to change"),
    invalidImage:         () => new AppError("Upload a JPG, PNG or WebP image of 2 MB or less", 400, true, "INVALID_IMAGE"),
    noPhotoFile:          () => new AppError("Choose a photo to upload", 400, true, "INVALID_IMAGE"),
};
