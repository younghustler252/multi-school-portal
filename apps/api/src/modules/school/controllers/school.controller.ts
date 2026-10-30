import { Request, Response, NextFunction } from "express";
import { GetSchoolUseCase }           from "../usecases/get-school.usecase";
import { UpdateSchoolUseCase }        from "../usecases/update-school.usecase";
import { UploadLogoUseCase }          from "../usecases/upload-logo.usecase";
import { UploadDocumentUseCase }      from "../usecases/upload-document.usecase";
import { GetDocumentsUseCase }        from "../usecases/get-documents.usecase";
import { SetupPaymentUseCase }        from "../usecases/setup-payment.usecase";
import { GetDashboardUseCase }        from "../usecases/get-dashboard.usecase";
import { GetSetupChecklistUseCase }   from "../usecases/get-setup-checklist.usecase";
import { GetPublicSchoolInfoUseCase } from "../usecases/get-public-school-info.usecase";
import { sendSuccess, sendCreated }   from "../../../shared/utils/api-response";
import { getAccess }                  from "../../../infrastructure/middleware/rbac.middleware";
import { schoolErrors }               from "../domain/school.errors";

interface Dependencies {
    getSchoolUseCase: GetSchoolUseCase; updateSchoolUseCase: UpdateSchoolUseCase; uploadLogoUseCase: UploadLogoUseCase;
    uploadDocumentUseCase: UploadDocumentUseCase; getDocumentsUseCase: GetDocumentsUseCase;
    setupPaymentUseCase: SetupPaymentUseCase; getDashboardUseCase: GetDashboardUseCase;
    getSetupChecklistUseCase: GetSetupChecklistUseCase; getPublicSchoolInfoUseCase: GetPublicSchoolInfoUseCase;
}

/*
| SCHOOL CONTROLLER (school realm + public). The school is always the one the request host resolved to
| (requireTenant guarantees it); the user is always req.auth. Nothing comes from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => {
    if (!req.auth) throw schoolErrors.notFound();
    return req.auth.userId;
};
const ipOf = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? "unknown";

export class SchoolController {
    constructor(private readonly d: Dependencies) {}

    getMySchool = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getSchoolUseCase.execute(schoolIdOf(req)), "School retrieved successfully"); } catch (e) { next(e); }
    };

    updateMySchool = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateSchoolUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "School updated successfully"); } catch (e) { next(e); }
    };

    uploadLogo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) throw schoolErrors.invalidImage("No file uploaded");
            sendSuccess(res, await this.d.uploadLogoUseCase.execute(schoolIdOf(req), userIdOf(req), { buffer: req.file.buffer }), "Logo uploaded successfully");
        } catch (e) { next(e); }
    };

    uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) throw schoolErrors.invalidFile("No file uploaded");
            sendCreated(res, await this.d.uploadDocumentUseCase.execute(schoolIdOf(req), userIdOf(req), req.body, { buffer: req.file.buffer }), "Document uploaded successfully");
        } catch (e) { next(e); }
    };

    getMyDocuments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getDocumentsUseCase.execute(schoolIdOf(req)), "Documents retrieved successfully"); } catch (e) { next(e); }
    };

    setupPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            sendSuccess(res, await this.d.setupPaymentUseCase.execute(schoolIdOf(req), { userId: userIdOf(req), ip: ipOf(req) }, req.body), "Payment setup successful");
        } catch (e) { next(e); }
    };

    getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const access = getAccess(req);
            sendSuccess(res, await this.d.getDashboardUseCase.execute(schoolIdOf(req), k => access.can(k)), "Dashboard retrieved successfully");
        } catch (e) { next(e); }
    };

    getSetupChecklist = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getSetupChecklistUseCase.execute(schoolIdOf(req)), "Setup checklist retrieved successfully"); } catch (e) { next(e); }
    };

    getPublicSchoolInfo = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPublicSchoolInfoUseCase.execute(String(req.params.subdomain)), "School info retrieved successfully"); } catch (e) { next(e); }
    };
}
