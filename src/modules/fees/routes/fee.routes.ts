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

const ctrl = () =>
    container.resolve<FeeController>("feeController");


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

// Get all invoices
router.get(
    "/invoices",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListInvoicesDto, "query"),
    (req, res, next) => ctrl().getInvoices(req, res, next),
);

// Get my children's invoices
// Keep this BEFORE /invoices/:id so "my-children" isn't treated as an ID.
router.get(
    "/invoices/my-children",
    authenticate,
    requireTenant,
    (req, res, next) => ctrl().getMyChildrenInvoices(req, res, next),
);

// Get invoice by ID
router.get(
    "/invoices/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getInvoiceById(req, res, next),
);

// Create invoice
router.post(
    "/invoices",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(CreateInvoiceDto),
    (req, res, next) => ctrl().createInvoice(req, res, next),
);

// Bulk create invoices
router.post(
    "/invoices/bulk",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(BulkCreateInvoiceDto),
    (req, res, next) => ctrl().bulkCreateInvoices(req, res, next),
);

// Update invoice
router.put(
    "/invoices/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(UpdateInvoiceDto),
    (req, res, next) => ctrl().updateInvoice(req, res, next),
);


// ── Defaulters Report ─────────────────────────────────────────────────────

router.get(
    "/defaulters",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getDefaulters(req, res, next),
);


// ── Invoice Entire Class ──────────────────────────────────────────────────

router.post(
    "/invoices/class",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("feeManagement"),
    validate(InvoiceClassDto),
    (req, res, next) => ctrl().invoiceClass(req, res, next),
);


// ── Record Manual Payment ─────────────────────────────────────────────────

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