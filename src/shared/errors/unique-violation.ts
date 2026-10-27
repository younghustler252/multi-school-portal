/*
|--------------------------------------------------------------------------
| Reading a database "already exists" error (Prisma P2002)
| Through the Postgres adapter, the error does NOT name the index. It only carries the column text taken from
| Postgres's message, for example `code`, `"sessionId", name` or `lower(email` (an index on lower(email)).
| So a rule is recognised by the COLUMN word, and by the table the write was made on.
|--------------------------------------------------------------------------
*/

export const isUniqueViolation = (err: any): boolean => err?.code === "P2002";

/** Everything the error says about the rule that fired, in lower case. */
const textOf = (err: any): string => {
    let meta = "";
    try { meta = JSON.stringify(err?.meta ?? {}); } catch { /* circular: ignore */ }
    return `${meta} ${err?.message ?? ""}`.toLowerCase();
};

/** True when the broken rule involves this column, e.g. `code`, or `email` inside `lower(email`. */
export function violatesColumn(err: any, column: string): boolean {
    if (!isUniqueViolation(err)) return false;
    return new RegExp(`(^|[^a-z0-9_])${column.toLowerCase()}([^a-z0-9_]|$)`).test(textOf(err));
}
