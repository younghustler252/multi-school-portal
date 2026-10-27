import { NewSettlement, NewSettlementItem, OnlinePaymentFacts, SettlementEntity, SettlementItemEntity } from "../domain/settlement.entity";

export interface Page<T> { rows: T[]; total: number }

export interface ISettlementRepository {
    /** Online (Paystack) payments with any of these references (ours or the gateway's), whatever their state. */
    findPaymentsByReferences(refs: string[]): Promise<OnlinePaymentFacts[]>;
    findPaymentsByIds(ids: string[]): Promise<OnlinePaymentFacts[]>;
    /** Confirmed, unreversed online payments no live settlement has paid out yet, oldest first. */
    listUnsettled(page: number, limit: number): Promise<Page<OnlinePaymentFacts> & { totalKobo: bigint }>;
    /** What the online payments clearing account holds in the books (debits minus credits), all dates. */
    clearingBalance(): Promise<bigint>;
    findByReference(provider: string, reference: string): Promise<SettlementEntity | null>;
    findById(id: string): Promise<{ settlement: SettlementEntity; items: SettlementItemEntity[] } | null>;
    list(page: number, limit: number): Promise<Page<SettlementEntity>>;
    /** Saves the settlement and claims its payments (call inside a transaction). False when a payment was claimed by another settlement first. */
    insert(s: NewSettlement, items: NewSettlementItem[]): Promise<boolean>;
    markReversed(id: string, by: string | null, reason: string): Promise<boolean>;
    /** Frees the payments of a reversed settlement so they can be settled again. */
    releaseItems(settlementId: string): Promise<void>;
}
