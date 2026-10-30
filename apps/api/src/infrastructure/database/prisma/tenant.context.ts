import { AsyncLocalStorage } from "async_hooks";
import type { Prisma } from "../../../generated/tenant";

/** The database client you get while a transaction is open (see withTenantTransaction in prisma.client.ts). */
export type TenantTransactionClient = Prisma.TransactionClient;

interface TenantContext {
  tenantSchema: string;
  schoolId: string;
  // Set only while withTenantTransaction is running. When it is set, getTenantClient() hands out this
  // transaction, so every repository call made inside joins it without any change to the repository.
  tx?: TenantTransactionClient;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const TenantContext = {
    // Set tenant context for the current request
    run<T>(context: TenantContext, fn: () => T): T {
        return tenantStorage.run(context, fn);
    },

  // Get current tenant context
    get(): TenantContext {
        const context = tenantStorage.getStore();
        if (!context) {
        throw new Error("No tenant context found. Are you inside a tenant request?");
        }
        return context;
    },

    // Get safely — returns null if no context (for public routes)
    getSafe(): TenantContext | null {
        return tenantStorage.getStore() ?? null;
    },

    getSchema(): string {
        return TenantContext.get().tenantSchema;
    },

    getSchoolId(): string {
        return TenantContext.get().schoolId;
    },

    // The open transaction of the current context, or null when none is open (never throws)
    getTransaction(): TenantTransactionClient | null {
        return tenantStorage.getStore()?.tx ?? null;
    },
};