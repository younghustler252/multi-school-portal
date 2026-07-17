import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg }      from "@prisma/adapter-pg";
import { TenantContext } from "./tenant.context";
import pg               from "pg";

/*
|--------------------------------------------------------------------------
| PUBLIC CLIENT (Global registries like School, User, Subscriptions)
|--------------------------------------------------------------------------
*/
const publicPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max:              20,
});

const publicAdapter = new PrismaPg(publicPool);
// Ensure our core export client behaves consistently
export const prisma = new PrismaClient({ adapter: publicAdapter });

/*
|--------------------------------------------------------------------------
| TENANT CLIENT CACHE
| One cached client per schema with dynamic runtime query interception
|--------------------------------------------------------------------------
*/
const tenantClients = new Map<string, PrismaClient>();

export const getTenantClient = (): PrismaClient => {
    const schema = TenantContext.getSchema();

    if (tenantClients.has(schema)) {
        return tenantClients.get(schema)!;
    }

    const tenantPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max:              5,
    });

    // Enforce fallback boundaries at the session engine level
    tenantPool.on("connect", (client) => {
        client.query(`SET search_path TO "${schema}", public`);
    });

    const tenantAdapter = new PrismaPg(tenantPool);
    const baseClient    = new PrismaClient({ adapter: tenantAdapter });

    // CRUCIAL: Intercept Prisma's hardcoded schema prefixes using an Extension wrapper
    const extendedClient = baseClient.$extends({
        query: {
            $allOperations: async ({ model, operation, args, query }) => {
                // If it's a tenant client execution thread, we force-switch the connection path
                // to make absolutely sure PostgreSQL prioritizes our school container tables
                await baseClient.$executeRawUnsafe(`SET search_path TO "${schema}", public;`);
                return query(args);
            }
        }
    }) as unknown as PrismaClient; // Cast to keep type compatibility with your repositories

    tenantClients.set(schema, extendedClient);
    return extendedClient;
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
};
