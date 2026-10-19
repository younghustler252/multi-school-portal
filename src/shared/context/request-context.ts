import { AsyncLocalStorage } from "async_hooks";

/*
| REQUEST CONTEXT: facts about the current request that any code may need without passing them around
| (request id, caller's address, who is signed in). The audit log reads it so every entry automatically records
| WHO (including an impersonating platform person), FROM WHERE, and WHICH REQUEST, with no change to the code that logs.
| The store is created once per request by requestContextMiddleware; authenticate() fills in the person.
| Background jobs have no request, so no store: audit entries from jobs carry only what the job passes in.
*/
export interface RequestContextStore {
    requestId:      string;
    ip:             string;
    userAgent:      string | null;
    userId?:        string;
    membershipId?:  string | null;
    impersonatedBy?: string;
}

const als = new AsyncLocalStorage<RequestContextStore>();

export const RequestContext = {
    run<T>(store: RequestContextStore, fn: () => T): T { return als.run(store, fn); },
    get(): RequestContextStore | undefined { return als.getStore(); },
    setActor(actor: { userId: string; membershipId: string | null; impersonatedBy?: string }): void {
        const s = als.getStore();
        if (!s) return;
        s.userId = actor.userId; s.membershipId = actor.membershipId; s.impersonatedBy = actor.impersonatedBy;
    },
};
