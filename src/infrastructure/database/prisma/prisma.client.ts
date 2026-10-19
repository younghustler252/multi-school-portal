// infrastructure/database/prisma/prisma.client.ts
import { env } from "../../../config/env";
import { PrismaClient as PublicPrismaClient } from "../../../generated/public/client";
import { PrismaClient as TenantPrismaClient } from "../../../generated/tenant/client";
import type { Prisma as TenantPrisma } from "../../../generated/tenant";
import { PrismaPg }      from "@prisma/adapter-pg";
import { TenantContext, TenantTransactionClient } from "./tenant.context";
import pg                from "pg";

const databaseUrl = env.DATABASE_URL;
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

const tenantClients = new Map<string, TenantPrismaClient>();
const tenantPools   = new Map<string, pg.Pool>();

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/*
|--------------------------------------------------------------------------
| TRANSACTION-AWARE TENANT CLIENT
| Inside withTenantTransaction (below) getTenantClient() returns the open transaction instead of the plain
| client, so repositories that call getTenantClient() on every query (all of them do) join the transaction
| with no change. The object returned there is the transaction client wrapped in one small shim: it has no
| $connect / $disconnect, and a $transaction call made inside it simply runs inside the transaction already
| open (so existing code that opens its own transaction keeps working when called from a bigger one).
|--------------------------------------------------------------------------
*/
const wrappedTransactions = new WeakMap<object, TenantPrismaClient>();

const asTransactionalClient = (tx: TenantTransactionClient): TenantPrismaClient => {
    const known = wrappedTransactions.get(tx);
    if (known) return known;

    const wrapped = new Proxy(tx as object, {
        get(target, prop) {
            if (prop === "$transaction") {
                return async (arg: unknown) => {
                    if (typeof arg === "function") return (arg as (client: unknown) => unknown)(tx);
                    const results: unknown[] = [];
                    for (const query of arg as PromiseLike<unknown>[]) results.push(await query);
                    return results;
                };
            }
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
        },
    }) as unknown as TenantPrismaClient;

    wrappedTransactions.set(tx, wrapped);
    return wrapped;
};

export const getTenantClient = (): TenantPrismaClient => {
    // Inside withTenantTransaction: use the open transaction
    const openTransaction = TenantContext.getTransaction();
    if (openTransaction) return asTransactionalClient(openTransaction);

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

    if (!SCHEMA_NAME_PATTERN.test(schema)) {
        throw new Error(`Invalid tenant schema name: ${schema}`);
    }

    const tenantPool = new pg.Pool({
        connectionString: databaseUrl,
        options:          `-c search_path="${schema}",public`,
        max:              5,
    });

    const tenantAdapter = new PrismaPg(tenantPool, { schema });
    const client = new TenantPrismaClient({ adapter: tenantAdapter });

    tenantClients.set(schema, client);
    tenantPools.set(schema, tenantPool);
    return client;
};

/*
|--------------------------------------------------------------------------
| withTenantTransaction
| Runs fn inside ONE database transaction on the current school's schema. If fn throws, everything it wrote
| is rolled back; if it returns, everything is saved together. Finance uses it so a payment and its
| journal are saved together or not at all.
|
|   const payment = await withTenantTransaction(async () => {
|       const payment = await paymentRepository.create(...);     // repositories join automatically
|       await postingService.post(...);
|       return payment;
|   });
|
| Rules:
|  - Calling it inside another withTenantTransaction joins that one (no second transaction, no nesting error).
|  - Keep it short. It holds one of the school's 5 database connections until it ends.
|  - Do NOT send emails, SMS, queue jobs or call Paystack inside it: those cannot be rolled back. Do them
|    after it returns.
|  - Do not start work inside it that you do not await (fire and forget): when the transaction ends, that
|    work would hit a closed transaction.
|  - Defaults: wait up to 5 s for a connection and run up to 20 s (Prisma's own defaults are 2 s and 5 s).
|--------------------------------------------------------------------------
*/
export interface TenantTransactionOptions {
    maxWait?:        number;
    timeout?:        number;
    isolationLevel?: TenantPrisma.TransactionIsolationLevel;
}

export const withTenantTransaction = async <T>(
    fn:      (tx: TenantTransactionClient) => Promise<T>,
    options: TenantTransactionOptions = {},
): Promise<T> => {
    const context = TenantContext.get();            // throws outside a school context, like getTenantClient()

    if (context.tx) return fn(context.tx);          // already inside one: join it

    const client = getTenantClient();               // no transaction open here, so this is the real client

    return client.$transaction(
        (tx) => TenantContext.run({ ...context, tx }, () => fn(tx)),
        {
            maxWait: options.maxWait ?? 5_000,
            timeout: options.timeout ?? 20_000,
            ...(options.isolationLevel && { isolationLevel: options.isolationLevel }),
        },
    );
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