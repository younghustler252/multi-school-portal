import { z } from "zod";

const id = z.string().min(1).max(64);
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(200).default(50);
const STATUSES = ["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS", "FAILED", "REVERSED", "CANCELLED"] as const;

/* Start the transfers of an approved run: which money account the salaries are paid out of. Amounts and bank details come from the approved run and pay profiles, never from the request. */
export const StartTransfersDto = z.object({ fromAccountId: id }).strict();
export const RetryTransferDto = z.object({ useCurrentBankDetails: z.boolean().optional() }).strict();
export const ReconcileTransfersDto = z.object({ transferId: id.optional() }).strict();

export const ListTransfersQuery = z.object({ status: z.enum(STATUSES).optional(), runId: id.optional(), page, limit });

export type StartTransfersDtoType = z.infer<typeof StartTransfersDto>;
export type RetryTransferDtoType = z.infer<typeof RetryTransferDto>;
export type ReconcileTransfersDtoType = z.infer<typeof ReconcileTransfersDto>;
export type ListTransfersQueryType = z.infer<typeof ListTransfersQuery>;
