// infrastructure/database/prisma/prisma.client.ts
import { PrismaClient as PublicPrismaClient } from "../../../generated/public/client";
import { PrismaClient as TenantPrismaClient } from "../../../generated/tenant/client";
import { PrismaPg }      from "@prisma/adapter-pg";
import { TenantContext } from "./tenant.context";
import pg                from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("🚨 FATAL: DATABASE_URL environment variable is missing inside your .env configuration file.");
}

/*
|--------------------------------------------------------------------------
| PUBLIC CLIENT (School, User, Plan, Subscription, AuditLog, ...)
|--------------------------------------------------------------------------
| Long-lived singleton. Always resolves against the database's default
| "public" Postgres schema — no per-request search_path juggling needed,
| since these tables genuinely live in one place platform-wide.
*/
const publicPool = new pg.Pool({
    connectionString: databaseUrl,
    max:              20,
});

const publicAdapter = new PrismaPg(publicPool);
export const prisma = new PublicPrismaClient({ adapter: publicAdapter });

/*
|--------------------------------------------------------------------------
| TENANT CLIENT CACHE (Staff, Student, Grade, Payment, ...)
|--------------------------------------------------------------------------
| One PrismaClient + dedicated pg.Pool per tenant schema, cached by schema
| name. Each pool is opened with the correct search_path baked into the
| Postgres connection's startup parameters (`options: -c search_path=...`),
| so every connection handed out by that pool already resolves unqualified
| table/enum names against the right tenant schema — no SQL string
| rewriting required, and no risk of a connection leaking into the wrong
| tenant's search_path, since each pool only ever serves one schema.
*/
const tenantClients = new Map<string, TenantPrismaClient>();
const tenantPools   = new Map<string, pg.Pool>();

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const getTenantClient = (): TenantPrismaClient => {
    const schema = TenantContext.getSchema();

    if (schema === "public") {
        throw new Error(
            "getTenantClient() was called outside a school tenant context. " +
            "Use the `prisma` (public) client instead, or ensure this route " +
            "sits behind requireTenant middleware."
        );
    }

    const cached = tenantClients.get(schema);
    if (cached) return cached;

    // Same guard provisionSchema.worker.ts uses — schema names should only
    // ever come from a slugified subdomain, but never trust it here either,
    // since it's about to be interpolated into a connection startup string.
    if (!SCHEMA_NAME_PATTERN.test(schema)) {
        throw new Error(`Invalid tenant schema name: ${schema}`);
    }

    const tenantPool = new pg.Pool({
        connectionString: databaseUrl,
        options:          `-c search_path="${schema}",public`,
        max:              5,
    });

    const tenantAdapter = new PrismaPg(tenantPool);
    const client = new TenantPrismaClient({ adapter: tenantAdapter });

    tenantClients.set(schema, client);
    tenantPools.set(schema, tenantPool);
    return client;
};

/*
|--------------------------------------------------------------------------
| DISCONNECT
|--------------------------------------------------------------------------
*/
export const disconnectPrisma = async (): Promise<void> => {
    await prisma.$disconnect();

    for (const client of tenantClients.values()) {
        await client.$disconnect();
    }
    tenantClients.clear();

    for (const pool of tenantPools.values()) {
        await pool.end();
    }
    tenantPools.clear();
};