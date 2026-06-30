import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg }      from "@prisma/adapter-pg";
import { TenantContext } from "./tenant.context";

/*
|--------------------------------------------------------------------------
| ADAPTER + PUBLIC CLIENT
|--------------------------------------------------------------------------
*/
const createAdapter = (schema?: string) => {
    const connectionString = schema
        ? `${process.env.DATABASE_URL}?schema=${schema}`
        : process.env.DATABASE_URL!;

    return new PrismaPg({ connectionString });
};

export const prisma = new PrismaClient({
    adapter: createAdapter(),
});

/*
|--------------------------------------------------------------------------
| TENANT CLIENT FACTORY
| Returns a client scoped to the current school's schema
|--------------------------------------------------------------------------
*/
export const getTenantClient = (): PrismaClient => {
    const schema = TenantContext.getSchema();

    return new PrismaClient({
        adapter: createAdapter(schema),
    });
};

/*
|--------------------------------------------------------------------------
| DISCONNECT
|--------------------------------------------------------------------------
*/
export const disconnectPrisma = async (): Promise<void> => {
    await prisma.$disconnect();
};