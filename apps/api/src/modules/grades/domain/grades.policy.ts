/*
|--------------------------------------------------------------------------
| GRADING RULES (pure: no database, easy to test)
| A SCALE is a list of bands; a band starts at its minScore and runs up to the next band's minScore (the top band
| reaches 100). So 74.5 falls in the band that starts at 70: there are no gaps between bands.
| A SCHEME is the list of parts a subject score is made of (e.g. CA 40 + Exam 60). Their maximum scores add up to 100.
|--------------------------------------------------------------------------
*/
export const GRADE_LEVELS = ["primary", "jss", "ss"] as const;
export type GradeLevel = typeof GRADE_LEVELS[number];
export type LevelKey = GradeLevel | "default";
export const LEVEL_KEYS: readonly LevelKey[] = ["default", ...GRADE_LEVELS];
export const isLevelKey = (v: string): v is LevelKey => (LEVEL_KEYS as readonly string[]).includes(v);

/** `Class.level` is free text today. Map it to a grading level; anything not recognised uses the default (null). */
export function levelOfClass(classLevel: string | null | undefined): GradeLevel | null {
    const v = (classLevel ?? "").trim().toLowerCase();
    if (!v) return null;
    if (/^(nursery|kg|kindergarten|pre|primary|pry|basic|elementary)/.test(v)) return "primary";
    if (/^(jss|js\b|junior)/.test(v)) return "jss";
    if (/^(sss|ss\b|senior|secondary)/.test(v)) return "ss";
    return null;
}

export const MAX_BANDS = 15;
export const MAX_COMPONENTS = 8;
export const SCHEME_TOTAL = 100;
export const PASS_FROM = 40;   // used only for the standard scale; each band says for itself whether it is a pass

export interface BandInput { minScore: number; grade: string; remark: string; isPass: boolean }
export interface ComponentInput { name: string; kind: "ca" | "exam"; maxScore: number }

const twoDecimals = (n: number) => Math.round(n * 100) / 100 === n;

/** Everything wrong with a list of bands, in plain words (empty = fine). */
export function validateBands(bands: BandInput[]): string[] {
    const problems: string[] = [];
    if (bands.length < 1 || bands.length > MAX_BANDS) problems.push(`A scale needs between 1 and ${MAX_BANDS} bands`);
    const mins = new Set<number>(); const labels = new Set<string>();
    for (const b of bands) {
        if (!Number.isFinite(b.minScore) || b.minScore < 0 || b.minScore >= 100 || !twoDecimals(b.minScore)) problems.push(`"${b.grade}": the starting score must be from 0 to below 100, with at most 2 decimals`);
        if (mins.has(b.minScore)) problems.push(`Two bands start at ${b.minScore}`);
        mins.add(b.minScore);
        const label = b.grade.trim().toLowerCase();
        if (!label) problems.push("Every band needs a grade");
        else if (labels.has(label)) problems.push(`The grade "${b.grade}" is used twice`);
        labels.add(label);
    }
    if (bands.length && !mins.has(0)) problems.push("The lowest band must start at 0, so every score has a grade");
    if (bands.length && !bands.some(b => b.isPass)) problems.push("At least one band must be a pass");
    // once a band is a pass, every higher band is a pass too
    const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
    let seenPass = false;
    for (const b of sorted) { if (b.isPass) seenPass = true; else if (seenPass) { problems.push(`"${b.grade}" is a fail but sits above a pass band`); break; } }
    return problems;
}

/** The band a total falls in (never undefined for a valid scale, because one band starts at 0). */
export function gradeFor<T extends { minScore: number }>(bands: T[], total: number): T | undefined {
    const desc = [...bands].sort((a, b) => b.minScore - a.minScore);
    return desc.find(b => total >= b.minScore) ?? desc[desc.length - 1];
}

export function validateComponents(components: ComponentInput[]): string[] {
    const problems: string[] = [];
    if (components.length < 1 || components.length > MAX_COMPONENTS) problems.push(`A scheme needs between 1 and ${MAX_COMPONENTS} parts`);
    const names = new Set<string>(); let total = 0;
    for (const c of components) {
        const n = c.name.trim().toLowerCase();
        if (!n) problems.push("Every part needs a name"); else if (names.has(n)) problems.push(`The part "${c.name}" is used twice`);
        names.add(n);
        if (!Number.isFinite(c.maxScore) || c.maxScore <= 0 || c.maxScore > SCHEME_TOTAL || !twoDecimals(c.maxScore)) problems.push(`"${c.name}": the maximum score must be above 0 and at most ${SCHEME_TOTAL}, with at most 2 decimals`);
        else total += c.maxScore;
    }
    if (components.length && Math.round(total * 100) / 100 !== SCHEME_TOTAL) problems.push(`The maximum scores add up to ${Math.round(total * 100) / 100}, but must add up to ${SCHEME_TOTAL}`);
    return problems;
}
