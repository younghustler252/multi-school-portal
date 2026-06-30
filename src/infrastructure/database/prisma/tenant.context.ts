import { AsyncLocalStorage } from "async_hooks";

interface TenantContext {
  tenantSchema: string;
  schoolId: string;
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
};