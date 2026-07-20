import { Request, Response, NextFunction, RequestHandler } from "express";

// ── School Admin Use Cases ────────────────────────────────────────────────
import { GetSchoolUseCase }        from "../usecases/school-admin/get-school.usecase";
import { UpdateSchoolUseCase }     from "../usecases/school-admin/update-school.usecase";
import { UploadLogoUseCase }       from "../usecases/school-admin/upload-logo.usecase";
import { UploadDocumentUseCase }   from "../usecases/school-admin/upload-document.usecase";
import { GetDocumentsUseCase }     from "../usecases/school-admin/get-documents.usecase";
import { SetupPaymentUseCase }     from "../usecases/school-admin/setup-payment.usecase";
import { GetDashboardUseCase } from "../usecases/school-admin/get-dashboard.usecase";

// ── Super Admin Use Cases ─────────────────────────────────────────────────
import { GetAllSchoolsUseCase }    from "../usecases/super-admin/get-all-schools.usecase";
import { GetSchoolByIdUseCase }    from "../usecases/super-admin/get-school-by-id.usecase";
import { CreateSchoolUseCase }     from "../usecases/super-admin/create-school.usecase";
import { VerifySchoolUseCase }     from "../usecases/super-admin/verify-school.usecase";
import { RejectSchoolUseCase }     from "../usecases/super-admin/reject-school.usecase";
import { SuspendSchoolUseCase }    from "../usecases/super-admin/suspend-school.usecase";
import { ActivateSchoolUseCase }   from "../usecases/super-admin/activate-school.usecase";
import { ApproveDocumentUseCase }  from "../usecases/super-admin/approve-document.usecase";
import { RejectDocumentUseCase }   from "../usecases/super-admin/reject-document.usecase";


import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                  from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| SCHOOL CONTROLLER
| Parses request → calls use case → sends response
|--------------------------------------------------------------------------
*/

interface Dependencies {
    // ── School Admin ──────────────────────────────────────────────────────
    getSchoolUseCase:       GetSchoolUseCase;
    updateSchoolUseCase:    UpdateSchoolUseCase;
    uploadLogoUseCase:      UploadLogoUseCase;
    uploadDocumentUseCase:  UploadDocumentUseCase;
    getDocumentsUseCase:    GetDocumentsUseCase;
    setupPaymentUseCase:    SetupPaymentUseCase;

    // ── Super Admin ───────────────────────────────────────────────────────
    getAllSchoolsUseCase:   GetAllSchoolsUseCase;
    getSchoolByIdUseCase:  GetSchoolByIdUseCase;
    createSchoolUseCase:   CreateSchoolUseCase;
    verifySchoolUseCase:   VerifySchoolUseCase;
    rejectSchoolUseCase:   RejectSchoolUseCase;
    suspendSchoolUseCase:  SuspendSchoolUseCase;
    activateSchoolUseCase: ActivateSchoolUseCase;
    approveDocumentUseCase: ApproveDocumentUseCase;
    rejectDocumentUseCase:  RejectDocumentUseCase;
}

export class SchoolController {
    private readonly getSchoolUseCase:        GetSchoolUseCase;
    private readonly updateSchoolUseCase:     UpdateSchoolUseCase;
    private readonly uploadLogoUseCase:       UploadLogoUseCase;
    private readonly uploadDocumentUseCase:   UploadDocumentUseCase;
    private readonly getDocumentsUseCase:     GetDocumentsUseCase;
    private readonly setupPaymentUseCase:     SetupPaymentUseCase;
    

    private readonly getAllSchoolsUseCase:     GetAllSchoolsUseCase;
    private readonly getSchoolByIdUseCase:    GetSchoolByIdUseCase;
    private readonly createSchoolUseCase:     CreateSchoolUseCase;
    private readonly verifySchoolUseCase:     VerifySchoolUseCase;
    private readonly rejectSchoolUseCase:     RejectSchoolUseCase;
    private readonly suspendSchoolUseCase:    SuspendSchoolUseCase;
    private readonly activateSchoolUseCase:   ActivateSchoolUseCase;
    private readonly approveDocumentUseCase:  ApproveDocumentUseCase;
    private readonly rejectDocumentUseCase:   RejectDocumentUseCase;

    constructor({
        getSchoolUseCase,
        updateSchoolUseCase,
        uploadLogoUseCase,
        uploadDocumentUseCase,
        getDocumentsUseCase,
        setupPaymentUseCase,
        getDashboardUseCase,


        getAllSchoolsUseCase,
        getSchoolByIdUseCase,
        createSchoolUseCase,
        verifySchoolUseCase,
        rejectSchoolUseCase,
        suspendSchoolUseCase,
        activateSchoolUseCase,
        approveDocumentUseCase,
        rejectDocumentUseCase,
    }: Dependencies) {
        this.getSchoolUseCase        = getSchoolUseCase;
        this.updateSchoolUseCase     = updateSchoolUseCase;
        this.uploadLogoUseCase       = uploadLogoUseCase;
        this.uploadDocumentUseCase   = uploadDocumentUseCase;
        this.getDocumentsUseCase     = getDocumentsUseCase;
        this.setupPaymentUseCase     = setupPaymentUseCase;
        this.getDashboardUseCase     = getDashboardUseCase


        this.getAllSchoolsUseCase     = getAllSchoolsUseCase;
        this.getSchoolByIdUseCase    = getSchoolByIdUseCase;
        this.createSchoolUseCase     = createSchoolUseCase;
        this.verifySchoolUseCase     = verifySchoolUseCase;
        this.rejectSchoolUseCase     = rejectSchoolUseCase;
        this.suspendSchoolUseCase    = suspendSchoolUseCase;
        this.activateSchoolUseCase   = activateSchoolUseCase;
        this.approveDocumentUseCase  = approveDocumentUseCase;
        this.rejectDocumentUseCase   = rejectDocumentUseCase;
    }

    // ========================================
    // SCHOOL ADMIN METHODS
    // ========================================

    // ── Get own school ────────────────────────────────────────────────────
    getMySchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSchoolUseCase.execute(
                req.user!.schoolId!,
            );
            sendSuccess(res, result, "School retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Update own school ─────────────────────────────────────────────────
    updateMySchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateSchoolUseCase.execute(
                req.user!.schoolId!,
                req.body,
            );
            sendSuccess(res, result, "School updated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Upload logo ───────────────────────────────────────────────────────
    uploadLogo = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const file = req.file;

            if (!file) {
                res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
                return;
            }

            const result = await this.uploadLogoUseCase.execute(
                req.user!.schoolId!,
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendSuccess(res, result, "Logo uploaded successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Upload document ───────────────────────────────────────────────────
    uploadDocument = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const file = req.file;

            if (!file) {
                res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
                return;
            }

            const result = await this.uploadDocumentUseCase.execute(
                req.user!.schoolId!,
                req.body,
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendCreated(res, result, "Document uploaded successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Get own documents ─────────────────────────────────────────────────
    getMyDocuments = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getDocumentsUseCase.execute(
                req.user!.schoolId!,
            );
            sendSuccess(res, result, "Documents retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Setup payment ─────────────────────────────────────────────────────
    setupPayment = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.setupPaymentUseCase.execute(
                req.user!.schoolId!,
                req.body,
            );
            sendSuccess(res, result, "Payment setup successful");
        } catch (err) {
            next(err);
        }
    };

    getDashboard = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getDashboardUseCase.execute(
                req.user!.schoolId!,
            );
            sendSuccess(res, result, "Dashboard data retrieved successfully");
        } catch (err) { next(err); }
    };

    // ========================================
    // SUPER ADMIN METHODS
    // ========================================

    // ── Get all schools ───────────────────────────────────────────────────
    getAllSchools = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAllSchoolsUseCase.execute({
                page:               Number(req.query.page),
                limit:              Number(req.query.limit),
                status:             req.query.status as string,
                verificationStatus: req.query.verificationStatus as string,
                search:             req.query.search as string,
            });
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };

    // ── Get school by ID ──────────────────────────────────────────────────
    getSchoolById = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSchoolByIdUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "School retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Create school (super admin) ───────────────────────────────────────
    createSchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createSchoolUseCase.execute(req.body);
            sendCreated(res, result, "School created successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Verify school ─────────────────────────────────────────────────────
    verifySchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.verifySchoolUseCase.execute({
                schoolId: req.params.id as string,
            });
            sendSuccess(res, result, "School verified successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Reject school ─────────────────────────────────────────────────────
    rejectSchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.rejectSchoolUseCase.execute({
                schoolId: req.params.id as string,
                reason:   req.body.reason,
            });
            sendSuccess(res, result, "School verification rejected");
        } catch (err) {
            next(err);
        }
    };

    // ── Suspend school ────────────────────────────────────────────────────
   suspendSchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.suspendSchoolUseCase.execute({
                schoolId: req.params.id as string,
                reason:   req.body.reason,
            });
            sendSuccess(res, result, "School suspended successfully");
        } catch (err) {
            next(err);
        }
    };


    // ── Activate school ───────────────────────────────────────────────────
    activateSchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.activateSchoolUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "School activated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Approve document ──────────────────────────────────────────────────
    approveDocument = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.approveDocumentUseCase.execute({
                documentId: req.params.documentId as string,
            });
            sendSuccess(res, result, "Document approved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Reject document ───────────────────────────────────────────────────
    rejectDocument = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.rejectDocumentUseCase.execute({
                documentId: req.params.documentId as string,
                reason:     req.body.reason,
            });
            sendSuccess(res, result, "Document rejected successfully");
        } catch (err) {
            next(err);
        }
    };
}