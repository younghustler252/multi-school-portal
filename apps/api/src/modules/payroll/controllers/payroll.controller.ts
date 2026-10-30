import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError, PermissionDeniedError } from "../../../shared/errors/domain.errors";
import {
    ListComponentsQuery, ListProfilesQuery, ListRunsQuery, ListPayslipsQuery, ListLoansQuery, ListRemittancesQuery,
} from "../dtos/payroll.dto";
import { PayslipViewer } from "../usecases/payslip.usecases";

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

/* Someone with ALL scope sees every payslip. Anyone else sees only their own, which needs them to be a staff member. */
const VIEW = "payroll.payslips.view";
export function viewerOf(req: Request, forceOwn = false): PayslipViewer {
    const scope = req.access?.scopeOf(VIEW) ?? null;
    if (!scope) throw new PermissionDeniedError(VIEW);
    if (scope === "ALL" && !forceOwn) return { scope: "ALL" };
    const staffId = req.access?.persona === "STAFF" ? req.access.personaEntityId : null;
    if (!staffId) throw new PermissionDeniedError(VIEW);
    return { scope: "OWN", staffId };
}

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => { try { await fn(req, res); } catch (e) { next(e); } };
const list = (res: Response, message: string, r: { data: unknown; meta: unknown }) => { res.status(200).json({ success: true, message, data: r.data, meta: r.meta }); };

/* PAYROLL CONTROLLER (school realm, /payroll and /my/payslips). One class, because every action is a thin call to a use case. */
export class PayrollController {
    constructor(private readonly d: Record<string, any>) {}

    /* components */
    listComponents  = wrap(async (req, res) => list(res, "Pay components retrieved successfully", await this.d.listComponentsUseCase.execute(ListComponentsQuery.parse(req.query))));
    getComponent    = wrap(async (req, res) => sendSuccess(res, await this.d.getComponentUseCase.execute(idOf(req)), "Pay component retrieved successfully"));
    createComponent = wrap(async (req, res) => sendCreated(res, await this.d.createComponentUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Pay component created successfully"));
    updateComponent = wrap(async (req, res) => sendSuccess(res, await this.d.updateComponentUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Pay component updated successfully"));
    setComponentActive = (isActive: boolean) => wrap(async (req, res) => sendSuccess(res, await this.d.setComponentActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), isActive), isActive ? "Pay component reactivated" : "Pay component deactivated"));
    deleteComponent = wrap(async (req, res) => sendSuccess(res, await this.d.deleteComponentUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Pay component deleted successfully"));

    /* profiles */
    listProfiles = wrap(async (req, res) => { const q = ListProfilesQuery.parse(req.query); list(res, "Pay profiles retrieved successfully", await this.d.listPayProfilesUseCase.execute(q.page, q.limit)); });
    getProfile   = wrap(async (req, res) => sendSuccess(res, await this.d.getPayProfileUseCase.execute(String(req.params.staffId)), "Pay profile retrieved successfully"));
    setProfile   = wrap(async (req, res) => sendCreated(res, await this.d.setPayProfileUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Pay profile saved successfully"));

    /* runs */
    listRuns   = wrap(async (req, res) => list(res, "Payroll runs retrieved successfully", await this.d.listRunsUseCase.execute(ListRunsQuery.parse(req.query))));
    getRun     = wrap(async (req, res) => sendSuccess(res, await this.d.getRunUseCase.execute(idOf(req)), "Payroll run retrieved successfully"));
    createRun  = wrap(async (req, res) => sendCreated(res, await this.d.createRunUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Payroll run started"));
    calculate  = wrap(async (req, res) => sendSuccess(res, await this.d.calculateRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Payroll run calculated"));
    submit     = wrap(async (req, res) => sendSuccess(res, await this.d.submitRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Payroll run sent for approval"));
    approve    = wrap(async (req, res) => sendSuccess(res, await this.d.approveRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payroll run approved"));
    reject     = wrap(async (req, res) => sendSuccess(res, await this.d.rejectRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payroll run sent back"));
    cancel     = wrap(async (req, res) => sendSuccess(res, await this.d.cancelRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payroll run cancelled"));
    reverse    = wrap(async (req, res) => sendSuccess(res, await this.d.reverseRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payroll run reversed"));
    pay        = wrap(async (req, res) => sendSuccess(res, await this.d.payRunUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payroll run paid"));

    /* payslips */
    listPayslips = wrap(async (req, res) => list(res, "Payslips retrieved successfully", await this.d.listPayslipsUseCase.execute(ListPayslipsQuery.parse(req.query), viewerOf(req))));
    getPayslip   = wrap(async (req, res) => sendSuccess(res, await this.d.getPayslipUseCase.execute(idOf(req), viewerOf(req)), "Payslip retrieved successfully"));
    myPayslips   = wrap(async (req, res) => list(res, "Your payslips retrieved successfully", await this.d.listPayslipsUseCase.execute(ListPayslipsQuery.parse(req.query), viewerOf(req, true))));
    myPayslip    = wrap(async (req, res) => sendSuccess(res, await this.d.getPayslipUseCase.execute(idOf(req), viewerOf(req, true)), "Payslip retrieved successfully"));
    document = (forceOwn: boolean) => wrap(async (req, res) => {
        const doc = await this.d.payslipDocumentUseCase.execute(idOf(req), viewerOf(req, forceOwn));
        res.status(200).type("html").setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
        res.send(doc.html);
    });

    /* loans */
    listLoans  = wrap(async (req, res) => list(res, "Staff loans retrieved successfully", await this.d.listLoansUseCase.execute(ListLoansQuery.parse(req.query))));
    getLoan    = wrap(async (req, res) => sendSuccess(res, await this.d.getLoanUseCase.execute(idOf(req)), "Staff loan retrieved successfully"));
    createLoan = wrap(async (req, res) => sendCreated(res, await this.d.createLoanUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Staff loan created successfully"));
    cancelLoan = wrap(async (req, res) => sendSuccess(res, await this.d.cancelLoanUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Staff loan cancelled"));

    /* remittances */
    listRemittances  = wrap(async (req, res) => list(res, "Remittances retrieved successfully", await this.d.listRemittancesUseCase.execute(ListRemittancesQuery.parse(req.query))));
    remittancesDue   = wrap(async (_req, res) => sendSuccess(res, await this.d.remittancesDueUseCase.execute(), "Amounts still owed retrieved successfully"));
    createRemittance = wrap(async (req, res) => sendCreated(res, await this.d.createRemittanceUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Remittance recorded"));
    reverseRemittance = wrap(async (req, res) => sendSuccess(res, await this.d.reverseRemittanceUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Remittance reversed"));
}
