/*
| WHO TEACHES WHAT IN A NEW TERM, worked out in memory (no database), so a whole school is planned in a few queries
| instead of one query per class and subject. Same rules the old per-class code used:
|  1. last term's assignments are copied as they were (assignedVia is kept)
|  2. any class + subject pair still without a teacher gets one: the subject's default teacher,
|     else (homeroom schools only) the class teacher
| The Classes pass reuses this for its own seeding.
*/
export interface PlanClass      { id: string; classTeacherId: string | null }
export interface PlanSubject    { id: string; defaultTeacherId: string | null }
export interface PlanAssignment { classId: string; subjectId: string; staffId: string; assignedVia: string }

export function planTermAssignments(p: {
    classes: PlanClass[]; subjects: PlanSubject[]; previous: PlanAssignment[];
    existing: Array<{ classId: string; subjectId: string }>; teachingModel: string | null;
}): { carried: PlanAssignment[]; seeded: PlanAssignment[] } {
    const key = (classId: string, subjectId: string) => `${classId}:${subjectId}`;
    const taken = new Set(p.existing.map(e => key(e.classId, e.subjectId)));
    const classIds = new Set(p.classes.map(c => c.id));
    const subjectIds = new Set(p.subjects.map(s => s.id));

    const carried: PlanAssignment[] = [];
    for (const a of p.previous) {
        if (!classIds.has(a.classId) || !subjectIds.has(a.subjectId) || taken.has(key(a.classId, a.subjectId))) continue;
        taken.add(key(a.classId, a.subjectId));
        carried.push(a);
    }

    const seeded: PlanAssignment[] = [];
    for (const c of p.classes) for (const s of p.subjects) {
        if (taken.has(key(c.id, s.id))) continue;
        if (s.defaultTeacherId) seeded.push({ classId: c.id, subjectId: s.id, staffId: s.defaultTeacherId, assignedVia: "auto_subject_default" });
        else if (p.teachingModel === "homeroom" && c.classTeacherId) seeded.push({ classId: c.id, subjectId: s.id, staffId: c.classTeacherId, assignedVia: "auto_homeroom" });
    }
    return { carried, seeded };
}
