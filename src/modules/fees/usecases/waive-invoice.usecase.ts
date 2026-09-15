import { IFeeRepository } from "../repositories/fee.repository";
import { AuditService }   from "../../audit/services/audit.service";
import { NotFoundError }  from "../../../shared/errors/domain.errors";
import { FeeErrorMessage } from "../domain/fee.enums";

interface Dependencies {
    feeRepository: IFeeRepository;
    auditService:  AuditService;
}

export class WaiveInvoiceUseCase {
    private readonly feeRepository: IFeeRepository;
    private readonly auditService:  AuditService;

    constructor({
        feeRepository,
        auditService,
    }: Dependencies) {
        this.feeRepository = feeRepository;
        this.auditService  = auditService;
    }

    async execute(
        invoiceId:       string,
        reason:          string | undefined,
        waivedByAdminId: string,
    ) {
        // ── Find invoice ──────────────────────────────────────────────────
        const invoice = await this.feeRepository.findInvoiceByIdEnriched(invoiceId);
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND);

        const oldStatus = invoice.status;
        const oldNote   = invoice.note;

        // ── Waive invoice ─────────────────────────────────────────────────
        await this.feeRepository.updateInvoiceFields(invoiceId, {
            status: "waived",
            note:   reason
                ? `${invoice.note ? invoice.note + " | " : ""}Waived: ${reason}`
                : invoice.note,
        });

        const updatedInvoice = await this.feeRepository
            .findInvoiceByIdEnriched(invoiceId);

        // ── Audit invoice waiver ──────────────────────────────────────────
        await this.auditService.log({
            userId:   waivedByAdminId,
            action:   "invoice.waived",
            entity:   "Invoice",
            entityId: invoiceId,
            oldValue: {
                invoiceId,
                status: oldStatus,
                note:   oldNote,
            },
            newValue: {
                invoiceId,
                status: updatedInvoice?.status ?? "waived",
                note:   updatedInvoice?.note ?? null,
            },
            metadata: {
                reason: reason ?? null,
                waivedByAdminId,
            },
        });

        return updatedInvoice;
    }
}
