import type { PromotionOverrideType } from "../dtos/enrolment.dto";

/*
| PROMOTION PLAN (pure: no database, easy to test).
| The server works out where every active student goes from the SAVED class order ("promoted into"):
|   a class promoted into another class -> promote there      a class that graduates (saved as none) -> graduate
|   a class with NO saved order          -> needs a decision   (an exception for each student, or set the order first)
| The browser only sends exceptions (overrides): promote to a chosen class, repeat, graduate, or exclude.
*/
export type PlanAction = "promote" | "repeat" | "graduate" | "exclude" | "needs_decision";
export interface PlanRow { studentId: string; fromClassId: string; action: PlanAction; toClassId: string | null; overridden: boolean }

export interface PlanInput {
    enrolments: Array<{ studentId: string; classId: string }>;
    /** classId -> the class it is promoted into (null = graduates). A class missing from the map has no saved order. */
    progression: Map<string, string | null>;
    overrides: PromotionOverrideType[];
}
export interface PlanResult { rows: PlanRow[]; unknownOverrides: string[]; needsDecisionClassIds: string[] }

export function planPromotion({ enrolments, progression, overrides }: PlanInput): PlanResult {
    const byStudent = new Map(overrides.map(o => [o.studentId, o]));
    const known = new Set(enrolments.map(e => e.studentId));
    const unknownOverrides = overrides.filter(o => !known.has(o.studentId)).map(o => o.studentId);

    const rows: PlanRow[] = enrolments.map(e => {
        const o = byStudent.get(e.studentId);
        if (o) {
            if (o.action === "promote") return { studentId: e.studentId, fromClassId: e.classId, action: "promote", toClassId: o.classId!, overridden: true };
            if (o.action === "repeat") return { studentId: e.studentId, fromClassId: e.classId, action: "repeat", toClassId: e.classId, overridden: true };
            return { studentId: e.studentId, fromClassId: e.classId, action: o.action, toClassId: null, overridden: true };
        }
        if (!progression.has(e.classId)) return { studentId: e.studentId, fromClassId: e.classId, action: "needs_decision", toClassId: null, overridden: false };
        const to = progression.get(e.classId) ?? null;
        return { studentId: e.studentId, fromClassId: e.classId, action: to ? "promote" : "graduate", toClassId: to, overridden: false };
    });

    const needsDecisionClassIds = [...new Set(rows.filter(r => r.action === "needs_decision").map(r => r.fromClassId))];
    return { rows, unknownOverrides, needsDecisionClassIds };
}

export const moves = (r: PlanRow): boolean => r.action === "promote" || r.action === "repeat";

/*
| WHAT HAPPENS TO ONE STUDENT: the single rule behind both the preview and the run, so they cannot disagree.
|  - a student who already has a place in the new term is left completely alone (never graduated, never moved)
|  - graduating = the final class has no next class: the student is marked graduated, the final-term enrolment is
|    closed, and no place is made in the new term
*/
export type PromotionOutcome = "promoted" | "repeated" | "graduated" | "excluded" | "already_enrolled";

export function promotionOutcome(action: Exclude<PlanAction, "needs_decision">, placedInNewTerm: boolean): PromotionOutcome {
    if (action === "exclude") return "excluded";
    if (placedInNewTerm) return "already_enrolled";
    if (action === "graduate") return "graduated";
    return action === "repeat" ? "repeated" : "promoted";
}

export const willGraduate = (r: Pick<PlanRow, "action">, placedInNewTerm: boolean): boolean =>
    r.action !== "needs_decision" && promotionOutcome(r.action, placedInNewTerm) === "graduated";
