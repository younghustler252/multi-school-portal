import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TenantContext } from "./tenant.context";
import pg from "pg";

// 1. Create a single, shared connection pool
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Adjust based on your server capacity
    idleTimeoutMillis: 30000,
});

const adapter = new PrismaPg(pool);

// 2. Base client instance using the shared connection pool
const basePrisma = new PrismaClient({ adapter });

/**
 * Global Tenant-Aware Prisma Client
 * Automatically prepends the correct schema search_path to EVERY query
 */
export const prisma = basePrisma.$extends({
    query: {
        $allOperations: async ({ model, operation, args, query }) => {
            // Get current schema from AsyncLocalStorage context safely
            const ctx = TenantContext.getSafe();
            const schema = ctx?.tenantSchema || 'public';

            // Set the search_path directly on the active connection before running the query
            await basePrisma.$executeRawUnsafe(`SET search_path TO "${schema}", public;`);
            
            return query(args);
        },
    },
});

export const disconnectPrisma = async (): Promise<void> => {
    await pool.end();
    await basePrisma.$disconnect();
};
