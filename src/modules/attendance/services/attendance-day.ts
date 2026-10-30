import { AttendanceRepository, TermRow } from "../repositories/attendance.repository";
import { attendanceErrors } from "../domain/attendance.errors";
import { holidayOn, isFutureDay, parseSchoolDay, termForDay } from "../domain/attendance.policy";

export interface SchoolDay { day: string; date: Date; term: TermRow; holiday: string | null }

/**
 * Turns "YYYY-MM-DD" into a school day: a real date, inside exactly one term (found from the date, never sent by
 * the browser), plus the calendar holiday on it if any. `forMarking` also refuses future days and holidays.
 */
export async function resolveSchoolDay(repo: AttendanceRepository, value: string, forMarking: boolean, now: Date = new Date()): Promise<SchoolDay> {
    const date = parseSchoolDay(value);
    if (!date) throw attendanceErrors.dateInvalid();
    if (forMarking && isFutureDay(value, now)) throw attendanceErrors.dateInFuture();

    const found = termForDay(await repo.allTerms(), value);
    if (found.kind === "none") throw attendanceErrors.outsideTerm();
    if (found.kind === "ambiguous") throw attendanceErrors.termAmbiguous();

    const holiday = holidayOn(await repo.holidayCandidates(date), value)?.title ?? null;
    if (forMarking && holiday) throw attendanceErrors.holiday(holiday);
    return { day: value, date, term: found.term, holiday };
}
