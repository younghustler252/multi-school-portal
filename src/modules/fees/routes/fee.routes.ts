import { Router }           from "express";
import { container }        from "../../../container";
import { FeeController }    from "../controllers/fee.controller";
import { validate }         from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }     from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                           from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }    from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requireFeature }   from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    CreateFeeTypeDto,
    CreateInvoiceDto,
    BulkCreateInvoiceDto,
    UpdateInvoiceDto,
    ListInvoicesDto,
    InvoiceClassDto,
    RecordPaymentDto,

}                           from "../dtos/fee.dto";


const router = Router();
const ctrl   = () => container.resolve<FeeController>("feeController");

// ── Fee Types ─────────────────────────────────────────────────────────────
router.get(
    "/types",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getFeeTypes(req, res, next),
);

router.post(
    "/types",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(CreateFeeTypeDto),
    (req, res, next) => ctrl().createFeeType(req, res, next),
);

// ── Invoices ──────────────────────────────────────────────────────────────
router.get(
    "/invoices",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListInvoicesDto, "query"),
    (req, res, next) => ctrl().getInvoices(req, res, next),
);

router.post(
    "/invoices",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(CreateInvoiceDto),
    (req, res, next) => ctrl().createInvoice(req, res, next),
);

router.post(
    "/invoices/bulk",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(BulkCreateInvoiceDto),
    (req, res, next) => ctrl().bulkCreateInvoices(req, res, next),
);

router.put(
    "/invoices/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(UpdateInvoiceDto),
    (req, res, next) => ctrl().updateInvoice(req, res, next),
);

// ── Defaulters report ─────────────────────────────────────────────────────
router.get(
    "/defaulters",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getDefaulters(req, res, next),
);


// Invoice entire class
router.post(
    "/invoices/class",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(InvoiceClassDto),
    (req, res, next) => ctrl().invoiceClass(req, res, next),
);

// Record manual payment (installment supported)
router.post(
    "/invoices/record-payment",
    authenticate,
    requireTenant,
    requireStaff,
    requireFeature("paymentCollection"),
    validate(RecordPaymentDto),
    (req, res, next) => ctrl().recordPayment(req, res, next),
);

export default router;