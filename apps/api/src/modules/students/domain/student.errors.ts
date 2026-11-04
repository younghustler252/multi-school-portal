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
    importNoFile:         () => new AppError("Choose a CSV file to upload", 400, true, "IMPORT_NO_FILE"),
    importFile:           (message: string, reason: string, missing?: string[]) => new AppError(message, 400, true, "IMPORT_FILE_INVALID", { reason, ...(missing ? { missing } : {}) }),
    importClassFilled:    (name: string) => new AppError(`${name} filled up while the import was running, so nothing was imported. Run the preview again`, 409, true, "IMPORT_CLASS_FILLED"),
    importConflict:       () => new AppError("Something else saved at the same moment (a repeated admission number or parent email), so nothing was imported. Run the preview again", 409, true, "IMPORT_CONFLICT"),
    notGraduated:         () => new AppError("This student has not graduated", 409, true, "STUDENT_NOT_GRADUATED"),
    reopenTermNotCurrent: () => new AppError("The enrolment can only be reopened while the term they graduated from is still the current term. Undo the graduation without reopening, then enrol the student in the current term", 409, true, "GRADUATION_TERM_NOT_CURRENT"),
    reopenNotFound:       () => new AppError("The final-term enrolment of this student could not be found, so it cannot be reopened", 409, true, "GRADUATION_ENROLMENT_NOT_FOUND"),
    reopenClassFull:      (name: string) => new AppError(`${name} is full, so the student cannot go back into it. Raise its capacity or undo the graduation without reopening`, 409, true, "GRADUATION_CLASS_FULL"),
    reopenInactive:       () => new AppError("Reactivate this student first: an inactive student cannot be put back in a class", 409, true, "STUDENT_INACTIVE"),
    branchInvalid:        () => new AppError("Choose an active branch of this school", 400, true, "STUDENT_BRANCH_INVALID"),
    alreadyInBranch:      () => new AppError("The student is already in that branch", 409, true, "STUDENT_ALREADY_IN_BRANCH"),
    transferGraduated:    () => new AppError("A graduate cannot be transferred. If the graduation was a mistake, undo it first", 409, true, "STUDENT_GRADUATED"),
    transferClassRequired: () => new AppError("This student has a place in a class this term. Choose the class (in the new branch) they move to", 400, true, "TRANSFER_CLASS_REQUIRED"),
    transferClassNotNeeded: () => new AppError("This student has no active class place this term, so no class can be chosen. Transfer them, then enrol them in a class of the new branch", 400, true, "TRANSFER_CLASS_NOT_NEEDED"),
    transferClassInvalid: () => new AppError("The class to move the student into was not found", 400, true, "TRANSFER_CLASS_INVALID"),
    transferClassBranch:  () => new AppError("The class must belong to the branch the student is moving to", 400, true, "TRANSFER_CLASS_BRANCH_MISMATCH"),
    transferClassFull:    (name: string) => new AppError(`${name} is full, so the student cannot move into it`, 409, true, "CLASS_FULL"),
    transferConflict:     () => new AppError("The student was changed by someone else at the same moment. Reload and try again", 409, true, "TRANSFER_CONFLICT"),
    nothingToUpdate:      () => new BadRequestError("Nothing to change"),
    invalidImage:         () => new AppError("Upload a JPG, PNG or WebP image of 2 MB or less", 400, true, "INVALID_IMAGE"),
    noPhotoFile:          () => new AppError("Choose a photo to upload", 400, true, "INVALID_IMAGE"),
};
