export interface InstalmentPlanEntity {
    id: string; invoiceId: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; createdAt: Date;
    lines: { lineNumber: number; dueDate: Date; amountKobo: bigint }[];
}

export interface IInstalmentRepository {
    findByInvoice(invoiceId: string): Promise<InstalmentPlanEntity | null>;
    save(invoiceId: string, lines: { lineNumber: number; dueDate: Date; amountKobo: bigint }[], createdById: string | null): Promise<InstalmentPlanEntity>;   // replaces any plan the invoice had
    cancel(invoiceId: string): Promise<boolean>;
}
