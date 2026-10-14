import { Request, Response, NextFunction } from "express";
import { ListSchoolsUseCase }            from "../usecases/platform/list-schools.usecase";
import { GetPlatformSchoolUseCase }      from "../usecases/platform/get-school.usecase";
import { CreatePlatformSchoolUseCase }   from "../usecases/platform/create-school.usecase";
import { UpdatePlatformSchoolUseCase }   from "../usecases/platform/update-school.usecase";
import { VerifySchoolUseCase }           from "../usecases/platform/verify-school.usecase";
import { RejectSchoolUseCase }           from "../usecases/platform/reject-school.usecase";
import { SuspendSchoolUseCase, ReactivateSchoolUseCase } from "../usecases/platform/suspend-school.usecase";
import { SchoolDocumentsReviewUseCase }  from "../usecases/platform/school-documents.usecases";
import { sendSuccess, sendCreated, sendPaginated } from "../../../shared/utils/api-response";
import { ListSchoolsQuery }              from "../dtos/school.dto";
import { schoolErrors }                  from "../domain/school.errors";

interface Dependencies {
    listSchoolsUseCase: ListSchoolsUseCase; getPlatformSchoolUseCase: GetPlatformSchoolUseCase;
    createPlatformSchoolUseCase: CreatePlatformSchoolUseCase; updatePlatformSchoolUseCase: UpdatePlatformSchoolUseCase;
    verifySchoolUseCase: VerifySchoolUseCase; rejectSchoolUseCase: RejectSchoolUseCase;
    suspendSchoolUseCase: SuspendSchoolUseCase; reactivateSchoolUseCase: ReactivateSchoolUseCase;
    schoolDocumentsReviewUseCase: SchoolDocumentsReviewUseCase;
}

/* PLATFORM CONTROLLER (mounted at /platform/schools). The acting person is always req.auth.userId. */
const actorOf = (req: Request): string => {
    if (!req.auth) throw schoolErrors.notFound();
    return req.auth.userId;
};
const idOf = (req: Request, name = "id"): string => String(req.params[name]);

export class SchoolPlatformController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // The validate middleware does not write query values back, so the query is parsed here
            const r = await this.d.listSchoolsUseCase.execute(ListSchoolsQuery.parse(req.query));
            sendPaginated(res, r.data, r.meta);
        } catch (e) { next(e); }
    };

    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPlatformSchoolUseCase.execute(idOf(req)), "School retrieved successfully"); } catch (e) { next(e); }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createPlatformSchoolUseCase.execute(req.body, actorOf(req)), "School created successfully"); } catch (e) { next(e); }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updatePlatformSchoolUseCase.execute(idOf(req), actorOf(req), req.body), "School updated successfully"); } catch (e) { next(e); }
    };

    verify = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.verifySchoolUseCase.execute(idOf(req), actorOf(req), req.body ?? {}), "School verified successfully"); } catch (e) { next(e); }
    };

    reject = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.rejectSchoolUseCase.execute(idOf(req), actorOf(req), req.body.reason), "School verification rejected"); } catch (e) { next(e); }
    };

    suspend = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.suspendSchoolUseCase.execute(idOf(req), actorOf(req), req.body.reason), "School suspended successfully"); } catch (e) { next(e); }
    };

    reactivate = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reactivateSchoolUseCase.execute(idOf(req), actorOf(req)), "School reactivated successfully"); } catch (e) { next(e); }
    };

    listDocuments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.schoolDocumentsReviewUseCase.list(idOf(req), actorOf(req)), "School documents retrieved successfully"); } catch (e) { next(e); }
    };

    approveDocument = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.schoolDocumentsReviewUseCase.approve(idOf(req, "documentId"), actorOf(req)), "Document approved successfully"); } catch (e) { next(e); }
    };

    rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.schoolDocumentsReviewUseCase.reject(idOf(req, "documentId"), actorOf(req), req.body.reason), "Document rejected successfully"); } catch (e) { next(e); }
    };
}
