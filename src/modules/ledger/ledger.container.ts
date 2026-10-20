import { asFunction } from "awilix";
import type { AwilixContainer } from "awilix";
import { getTenantClient, withTenantTransaction } from "../../infrastructure/database/prisma/prisma.client";
import { RequestContext } from "../../shared/context/request-context";
import { NumberSequenceService } from "../../shared/services/number-sequence.service";
import { PostingService, type PostingDb } from "./ledger.posting";
import { BooksService, type BooksDb } from "./ledger.books";
import { LedgerReportService, type ReportDb } from "./ledger.reports";

/*
| Requires: audit (auditService). Registers the posting service (for other finance modules), the books service and the book reports.
| Routes, use cases and controllers for the ledger arrive with the later pieces of phase 1.
*/
export const registerLedger = (container: AwilixContainer): void => {
    container.register({
        postingService: asFunction(({ auditService }: { auditService: ConstructorParameters<typeof PostingService>[0]["auditService"] }) =>
            new PostingService({
                db:  () => getTenantClient() as unknown as PostingDb,
                tx:  (fn) => withTenantTransaction(async () => fn()),
                numberSequenceService: new NumberSequenceService(),
                auditService,
                currentUserId: () => RequestContext.get()?.userId,
            })).scoped(),
        booksService: asFunction(({ postingService }: { postingService: PostingService }) =>
            new BooksService({ db: () => getTenantClient() as unknown as BooksDb, posting: postingService })).scoped(),
        ledgerReportService: asFunction(() =>
            new LedgerReportService({ db: () => getTenantClient() as unknown as ReportDb })).scoped(),
    });
};
