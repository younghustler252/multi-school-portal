import { Request, Response, NextFunction } from "express";
import { ListScalesUseCase, SaveScaleUseCase, DeleteScaleUseCase, ListSchemesUseCase, SaveSchemeUseCase, DeleteSchemeUseCase, GradesActor } from "../usecases/grades-setup.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { gradesErrors } from "../domain/grades.errors";

interface Dependencies {
    listScalesUseCase: ListScalesUseCase; saveScaleUseCase: SaveScaleUseCase; deleteScaleUseCase: DeleteScaleUseCase;
    listSchemesUseCase: ListSchemesUseCase; saveSchemeUseCase: SaveSchemeUseCase; deleteSchemeUseCase: DeleteSchemeUseCase;
}

/* GRADES SETUP CONTROLLER (school realm). The acting person comes ONLY from the verified session, never the body. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request): GradesActor => { if (!req.auth) throw gradesErrors.notFound("Session"); return { userId: req.auth.userId }; };
const levelOf = (req: Request): string => String(req.params.level);

export class GradesSetupController {
    constructor(private readonly d: Dependencies) {}

    scales       = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listScalesUseCase.execute(), "Grading scales retrieved successfully"); } catch (e) { next(e); } };
    saveScale    = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.saveScaleUseCase.execute(schoolIdOf(req), levelOf(req), req.body, actorOf(req)), "Grading scale saved"); } catch (e) { next(e); } };
    deleteScale  = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteScaleUseCase.execute(schoolIdOf(req), levelOf(req), actorOf(req)), "Grading scale removed"); } catch (e) { next(e); } };
    schemes      = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listSchemesUseCase.execute(), "Assessment schemes retrieved successfully"); } catch (e) { next(e); } };
    saveScheme   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.saveSchemeUseCase.execute(schoolIdOf(req), levelOf(req), req.body, actorOf(req)), "Assessment scheme saved"); } catch (e) { next(e); } };
    deleteScheme = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteSchemeUseCase.execute(schoolIdOf(req), levelOf(req), actorOf(req)), "Assessment scheme removed"); } catch (e) { next(e); } };
}
