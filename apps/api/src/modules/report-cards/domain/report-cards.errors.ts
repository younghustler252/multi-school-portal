import { AppError, NotFoundError, ForbiddenError } from "../../../shared/errors/domain.errors";

/* Report card errors. Codes are stable; the frontend switches on them. */
export const reportCardErrors = {
    notFound:         () => new NotFoundError("Report card"),
    classNotFound:    () => new NotFoundError("Class"),
    termNotFound:     () => new AppError("There is no current term. Pick a term", 409, true, "REPORT_CARDS_NO_TERM"),
    cannotSee:        () => new ForbiddenError("You cannot see this class"),
    notAllowed:       (what: string) => new ForbiddenError(`You are not allowed to ${what}`),
    notYourClass:     () => new ForbiddenError("Only the class teacher of this class (or an administrator) can do this"),
    nothingPublished: () => new AppError("No mark sheet of this class is published for this term yet, so there is nothing to build a report card from", 409, true, "REPORT_CARDS_NOTHING_PUBLISHED"),
    notEditable:      (status: string) => new AppError(`This report card is ${status}. Take it back to draft before changing it`, 409, true, "REPORT_CARD_NOT_EDITABLE", { status }),
    templateUnavailable: (why: string) => new AppError(why, 409, true, "REPORT_CARD_TEMPLATE_UNAVAILABLE"),
    noPdf:            () => new AppError("This report card has no content yet. Generate it first", 409, true, "REPORT_CARD_EMPTY"),
};
