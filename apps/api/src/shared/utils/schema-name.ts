/*
|--------------------------------------------------------------------------
| TENANT SCHEMA NAMES (the only place they are made or checked)
| Each school has its own PostgreSQL schema. Its name is built ONCE, when the school record is created, from the
| subdomain, and stored in School.schemaName. Everything else reads the stored value; nothing rebuilds it.
|
| A subdomain may contain hyphens, a schema name may not (we quote it, but the pattern below is what we accept), so
| hyphens become underscores:  core-test-ab12  ->  school_core_test_ab12
| Subdomains cannot contain underscores, so two different subdomains never give the same schema name.
|--------------------------------------------------------------------------
*/
export const SCHEMA_PREFIX = "school_";
/** PostgreSQL cuts identifiers at 63 bytes. */
export const SCHEMA_NAME_MAX = 63;
export const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export const isValidSchemaName = (name: unknown): name is string =>
    typeof name === "string" && name.length <= SCHEMA_NAME_MAX && SCHEMA_NAME_PATTERN.test(name);

/** The schema name for a subdomain. Throws when the subdomain cannot make a valid one. */
export function schemaNameFor(subdomain: string): string {
    const name = `${SCHEMA_PREFIX}${subdomain.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
    if (!isValidSchemaName(name) || name === SCHEMA_PREFIX) throw new Error(`Cannot make a schema name from subdomain "${subdomain}"`);
    return name;
}
