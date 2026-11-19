import { loadOutstandingHandover, type HandoverReport, type SqlClient } from "./handover.read-model";

/*
| THE HANDOVER REPORT ACROSS SCHOOLS (read-only).
| Reads each school's own schema inside a READ ONLY transaction and collects the outstanding handover. One school that
| cannot be read never stops the others: it is recorded as a failure. Used by scripts/report-orphaned-assignments.ts.
*/
export interface SchoolRef { id: string; name: string; schemaName: string | null; timezone?: string | null }
export interface PooledClient extends SqlClient { release(): void }
export interface ClientPool { connect(): Promise<PooledClient> }

export interface SchoolResult { schoolId: string; school: string; report: HandoverReport }
export interface AcrossSchools {
    results: SchoolResult[];
    skipped: { schoolId: string; school: string; reason: string }[];
    failures: { schoolId: string; school: string; error: string }[];
    summary: { schoolsRead: number; schoolsWithHandover: number; schoolsSkipped: number; schoolsFailed: number; teachers: number; classesLed: number; outstandingSubjects: number; defaultsToUpdate: number; completedSubjects: number };
}

const SAFE_SCHEMA = /^[A-Za-z0-9_]+$/;
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** The calendar date (YYYY-MM-DD) in the school's timezone. An unknown timezone falls back to UTC. */
export function schoolLocalDate(now: Date, timezone?: string | null): string {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
    catch { return now.toISOString().slice(0, 10); }
}

export async function reportAcrossSchools(deps: { schools: SchoolRef[]; pool: ClientPool; now?: Date }): Promise<AcrossSchools> {
    const now = deps.now ?? new Date();
    const out: AcrossSchools = { results: [], skipped: [], failures: [], summary: { schoolsRead: 0, schoolsWithHandover: 0, schoolsSkipped: 0, schoolsFailed: 0, teachers: 0, classesLed: 0, outstandingSubjects: 0, defaultsToUpdate: 0, completedSubjects: 0 } };

    for (const school of deps.schools) {
        const ref = { schoolId: school.id, school: school.name };
        if (!school.schemaName) { out.skipped.push({ ...ref, reason: "no school schema yet" }); continue; }
        if (!SAFE_SCHEMA.test(school.schemaName)) { out.failures.push({ ...ref, error: `refused: unusual schema name "${school.schemaName}"` }); continue; }

        let client: PooledClient | null = null;
        try {
            client = await deps.pool.connect();
            await client.query("BEGIN READ ONLY");
            await client.query(`SET LOCAL search_path TO ${quote(school.schemaName)}`);
            const report = await loadOutstandingHandover(client, { now, today: schoolLocalDate(now, school.timezone) });
            await client.query("ROLLBACK");
            out.results.push({ ...ref, report });
        } catch (err) {
            if (client) await client.query("ROLLBACK").catch(() => undefined);
            out.failures.push({ ...ref, error: (err as Error).message });
        } finally { client?.release(); }
    }

    const s = out.summary, add = (f: (r: HandoverReport) => number) => out.results.reduce((n, x) => n + f(x.report), 0);
    s.schoolsRead = out.results.length; s.schoolsSkipped = out.skipped.length; s.schoolsFailed = out.failures.length;
    s.schoolsWithHandover = out.results.filter(x => x.report.totals.teachersNeedingAttention > 0).length;
    s.teachers = add(r => r.totals.teachersNeedingAttention); s.classesLed = add(r => r.totals.classesLed);
    s.outstandingSubjects = add(r => r.totals.outstandingSubjects); s.defaultsToUpdate = add(r => r.totals.defaultsToUpdate); s.completedSubjects = add(r => r.totals.completedSubjects);
    return out;
}

/** The report as plain lines for the console. */
export function formatSchoolResult(x: SchoolResult): string[] {
    const t = x.report.totals;
    const lines = [`${t.teachersNeedingAttention ? "!" : " "} ${x.school}: ${t.teachersNeedingAttention} teacher(s) to hand over, ${t.classesLed} class(es) led, ${t.outstandingSubjects} subject assignment(s) outstanding, ${t.defaultsToUpdate} default(s) to update, ${t.completedSubjects} finished (no action)`];
    for (const p of x.report.teachers) {
        lines.push(`     ${p.staff.name} (${p.staff.category}, left ${p.staff.exitDate ?? "date not recorded"}${p.staff.exitReason ? `: ${p.staff.exitReason}` : ""})`);
        for (const c of p.classesLed) lines.push(`        leads ${c.className}`);
        for (const s of p.outstandingSubjects) lines.push(`        teaches ${s.subjectName} in ${s.className} (${s.termName}${s.isCurrentTerm ? ", current" : ", upcoming"}; sheet: ${s.sheetStatus ?? "not started"})`);
        for (const s of p.completedSubjects) lines.push(`        finished: ${s.subjectName} in ${s.className} (${s.termName}; sheet ${s.sheetStatus})`);
        for (const d of p.defaultsToUpdate) lines.push(`        default teacher of ${d.subjectName}`);
        if (p.pastTermAssignments) lines.push(`        (${p.pastTermAssignments} past-term assignment(s): history, untouched)`);
    }
    return lines;
}

/** Command-line options: only `--json <file>`. Anything else is an error, so a typo never silently skips the output file. */
export function parseReportArgs(argv: string[]): { jsonPath: string | null } {
    let jsonPath: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--json") {
            const next = argv[i + 1];
            if (!next || next.startsWith("--")) throw new Error("--json needs a file path, e.g. --json report.json");
            jsonPath = next; i++;
        } else throw new Error(`unknown option "${argv[i]}" (the only option is --json <file>)`);
    }
    return { jsonPath };
}
