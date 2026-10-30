import { Request, Response, NextFunction } from "express";
import { ListEnrolmentsUseCase } from "../usecases/list-enrolments.usecase";
import { EnrolStudentUseCase } from "../usecases/enrol-student.usecase";
import { BulkEnrolUseCase } from "../usecases/bulk-enrol.usecase";
import { UpdateEnrolmentUseCase } from "../usecases/update-enrolment.usecase";
import { PreviewPromotionUseCase, PromoteStudentsUseCase } from "../usecases/promotion.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { ListEnrolmentsQuery, PromotionPreviewQuery } from "../dtos/enrolment.dto";
import { enrolmentErrors } from "../domain/enrolment.errors";
import { EnrolmentActor } from "../domain/enrolment.types";

interface Dependencies {
    listEnrolmentsUseCase: ListEnrolmentsUseCase; enrolStudentUseCase: EnrolStudentUseCase; bulkEnrolUseCase: BulkEnrolUseCase;
    updateEnrolmentUseCase: UpdateEnrolmentUseCase; previewPromotionUseCase: PreviewPromotionUseCase; promoteStudentsUseCase: PromoteStudentsUseCase;
}

/*
| ENROLMENT CONTROLLER (school realm, /enrolments). The school is the host's school; the acting person comes ONLY
| from the verified session (req.auth), never from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request): EnrolmentActor => { if (!req.auth) throw enrolmentErrors.notFound(); return { userId: req.auth.userId }; };

export class EnrolmentController {
    constructor(private readonly d: Dependencies) {}

    // The validate middleware does not write query values back, so queries are parsed here
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listEnrolmentsUseCase.execute(ListEnrolmentsQuery.parse(req.query), getAccess(req));
            res.status(200).json({ success: true, message: "Enrolments retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    enrol = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.enrolStudentUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Student enrolled successfully"); } catch (e) { next(e); } };
    bulkEnrol = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.bulkEnrolUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Enrolment completed"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateEnrolmentUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, actorOf(req)), "Enrolment updated successfully"); } catch (e) { next(e); } };
    previewPromotion = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.previewPromotionUseCase.execute(PromotionPreviewQuery.parse(req.query)), "Promotion preview retrieved successfully"); } catch (e) { next(e); } };
    promote = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.promoteStudentsUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Promotion completed"); } catch (e) { next(e); } };
}
