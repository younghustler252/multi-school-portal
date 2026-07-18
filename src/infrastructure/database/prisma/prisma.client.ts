import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg }      from "@prisma/adapter-pg";
import { TenantContext } from "./tenant.context";
import pg               from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("🚨 FATAL: DATABASE_URL environment variable is missing inside your .env configuration file.");
}

/*
|--------------------------------------------------------------------------
| PUBLIC CLIENT (Global registries like School, User, Subscriptions)
|--------------------------------------------------------------------------
*/
const publicPool = new pg.Pool({
    connectionString: databaseUrl,
    max:              20,
});

const publicAdapter = new PrismaPg(publicPool);
export const prisma = new PrismaClient({ adapter: publicAdapter });

/*
|--------------------------------------------------------------------------
| TENANT CLIENT CACHE WITH UNBREAKABLE SQL REWRITING INTERCEPTOR
|--------------------------------------------------------------------------
*/
const tenantClients = new Map<string, PrismaClient>();

export const getTenantClient = (): PrismaClient => {
    const schema = TenantContext.getSchema();

    if (!schema || schema === "public") {
        return prisma;
    }

    if (tenantClients.has(schema)) {
        return tenantClients.get(schema)!;
    }

    const tenantPool = new pg.Pool({
        connectionString: databaseUrl,
        max:              5,
    });

    // ── THE MULTI-FORMAT STRING OVERWRITE ENGINE ──────────────────────────
    // Intercepts query executions whether passed as flat text strings or 
    // structured compilation config objects by the adapter layer.
    const originalQuery = tenantPool.query;
    
    tenantPool.query = function (this: any, ...args: any[]) {
        if (args.length > 0) {
            let sqlText = "";
            let isConfigObject = false;

            // 1. Detect parameter packaging format using the first argument pointer
            if (typeof args[0] === "string") {
                sqlText = args[0];
            } else if (args[0] && typeof args[0] === "object" && typeof args[0].text === "string") {
                sqlText = args[0].text;
                isConfigObject = true;
            }

            // 2. Perform string correction if valid SQL payload exists
            if (sqlText) {
                // Exact model strings matching your generated Prisma client capitalization
                const globalTables = ['"School"', '"User"', '"Subscription"', '"Plan"', '"AuditLog"'];
                const targetsGlobalTable = globalTables.some(table => sqlText.includes(table));

                if (!targetsGlobalTable) {
                    // Strip the hardcoded public path string constraints permanently
                    sqlText = sqlText.replace(/"public"\./g, `"${schema}".`);
                    sqlText = sqlText.replace(/AS "public"\./gi, `AS "${schema}".`);
                    
                    // Route system-wide enums strictly back to the public schema mapping
                    const globalEnums = [
                        '"Gender"', 
                        '"StaffRole"', 
                        '"Role"',
                        '"EnrolmentStatus"',
                        '"GuardianRelation"',
                        '"AttendanceStatus"',
                        '"InvoiceStatus"',
                        '"PaymentMethod"'
                    ];
                    
                    for (const enumType of globalEnums) {
                        const brokenCast = `AS "${schema}".${enumType}`;
                        const correctCast = `AS "public".${enumType}`;
                        sqlText = sqlText.replace(new RegExp(brokenCast, 'g'), correctCast);
                    }

                    // 3. Re-assign corrected value back into the arguments array index zero
                    if (isConfigObject) {
                        args[0].text = sqlText;
                    } else {
                        args[0] = sqlText;
                    }
                }
            }
        }
        
        return originalQuery.apply(this, args as any);
    } as any;

    const tenantAdapter = new PrismaPg(tenantPool);

    const client = new PrismaClient({ 
        adapter: tenantAdapter,
        log: [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" }
        ]
    });

    client.$on("query" as any, (e: any) => {
        let trueSql = e.query;
        const globalTables = ['"School"', '"User"', '"Subscription"', '"Plan"', '"AuditLog"'];
        const targetsGlobalTable = globalTables.some(table => trueSql.includes(table));
        
        if (!targetsGlobalTable) {
            trueSql = trueSql.replace(/"public"\./g, `"${schema}".`);
            trueSql = trueSql.replace(/AS "public"\./gi, `AS "${schema}".`);
        }
        
        console.log(`\n🚀 [ISOLATED ROUTING ENGINE EXECUTION] Tenant: ${schema}`);
        console.log(`   SQL -> ${trueSql}`);
    });

    tenantClients.set(schema, client);
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
};
