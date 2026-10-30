import { classErrors } from "./class.errors";
import { isUniqueViolation, violatesColumn } from "../../../shared/errors/unique-violation";

/*
| When two requests save the same name at the same moment, the app's own check cannot see the other one; the
| database refuses the second. These turn that refusal into the same friendly error the app check gives.
| Anything that is not an "already exists" error is passed through unchanged.
*/
export const classWriteError = (err: unknown): unknown => (isUniqueViolation(err) ? classErrors.nameTaken() : err);

/** Subject has two rules: code (already unique) and name. The adapter names the column, so we can tell them apart. */
export const subjectWriteError = (err: unknown): unknown =>
    !isUniqueViolation(err) ? err : violatesColumn(err, "code") ? classErrors.subjectCodeTaken() : classErrors.subjectNameTaken();
