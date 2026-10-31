import { Request, Response, NextFunction } from "express";
import { ListSheetsUseCase, GetSheetUseCase, ListGradesUseCase } from "../usecases/grades-sheets-read.usecases";
import { SaveScoresUseCase } from "../usecases/save-scores.usecase";
import { SheetTransitionUseCase } from "../usecases/sheet-transition.usecase";
import { sendSuccess } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { ListSheetsQuery, ListGradesQuery, SheetParams } from "../dtos/grades-sheets.dto";
import { gradesErrors } from "../domain/grades.errors";
import { SheetAction } from "../domain/sheet.policy";

interface Dependencies { listSheetsUseCase: ListSheetsUseCase; getSheetUseCase: GetSheetUseCase; listGradesUseCase: ListGradesUseCase; saveScoresUseCase: SaveScoresUseCase; sheetTransitionUseCase: SheetTransitionUseCase }

/* GRADES MARK SHEET CONTROLLER (school realm). The acting person comes ONLY from the verified session, never the body. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request) => { if (!req.auth) throw gradesErrors.sheetNotFound(); return { userId: req.auth.userId }; };
const sheetIdOf = (req: Request): string => SheetParams.parse(req.params).classSubjectId;

export class GradesSheetsController {
    constructor(private readonly d: Dependencies) {}

    sheets = async (req: Request, res: Response, next: NextFunction) => { try { const r = await this.d.listSheetsUseCase.execute(ListSheetsQuery.parse(req.query), getAccess(req)); res.status(200).json({ success: true, message: "Mark sheets retrieved successfully", data: r.data, meta: r.meta }); } catch (e) { next(e); } };
    sheet  = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getSheetUseCase.execute(sheetIdOf(req), getAccess(req)), "Mark sheet retrieved successfully"); } catch (e) { next(e); } };
    grades = async (req: Request, res: Response, next: NextFunction) => { try { const r = await this.d.listGradesUseCase.execute(ListGradesQuery.parse(req.query), getAccess(req)); res.status(200).json({ success: true, message: "Grades retrieved successfully", data: r.data, meta: r.meta }); } catch (e) { next(e); } };
    saveScores = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.saveScoresUseCase.execute(schoolIdOf(req), sheetIdOf(req), req.body, getAccess(req), actorOf(req)), "Scores saved"); } catch (e) { next(e); } };

    move = (action: SheetAction, message: string) => async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.sheetTransitionUseCase.execute(action, schoolIdOf(req), sheetIdOf(req), req.body ?? {}, getAccess(req), actorOf(req)), message); } catch (e) { next(e); }
    };
}
