import { Request, Response, NextFunction } from "express";
import { CreateClassUseCase }       from "../usecases/school-admin/create-class.usecase";
import { UpdateClassUseCase }       from "../usecases/school-admin/update-class.usecase";
import { GetClassesUseCase }        from "../usecases/school-admin/get-classes.usecase";
import { SetClassTeacherUseCase } from "../usecases/school-admin/set-classteacher.usecase";
import { GetClassByIdUseCase } from "../usecases/school-admin/get-class-by-id.usecase";
import { CreateSubjectUseCase }     from "../usecases/school-admin/create-subject.usecase";
import { DeleteClassUseCase } from "../usecases/school-admin/delete-class.usecase";
import { GetSubjectsUseCase }       from "../usecases/school-admin/get-subjects.usecase";
import { AssignSubjectUseCase }     from "../usecases/school-admin/assign-subject.usecase";
import { GetClassSubjectsUseCase }  from "../usecases/school-admin/get-class-subjects.usecase";
import { RemoveSubjectUseCase }     from "../usecases/school-admin/remove-subject.usecase";
import {
    sendSuccess,
    sendCreated,
}                                   from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| CLASS CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createClassUseCase:      CreateClassUseCase;
    updateClassUseCase:      UpdateClassUseCase;
    getClassesUseCase:       GetClassesUseCase;
    getClassByIdUseCase:     GetClassByIdUseCase;
    deleteClassUseCase:      DeleteClassUseCase;
    createSubjectUseCase:    CreateSubjectUseCase;
    getSubjectsUseCase:      GetSubjectsUseCase;
    assignSubjectUseCase:    AssignSubjectUseCase;
    getClassSubjectsUseCase: GetClassSubjectsUseCase;
    removeSubjectUseCase:    RemoveSubjectUseCase;
    setClassTeacherUseCase:  SetClassTeacherUseCase;
}

export class ClassController {
    private readonly createClassUseCase:      CreateClassUseCase;
    private readonly updateClassUseCase:      UpdateClassUseCase;
    private readonly getClassesUseCase:       GetClassesUseCase;
    private readonly getClassByIdUseCase:     GetClassByIdUseCase;
    private readonly setClassTeacherUseCase:   SetClassTeacherUseCase;
    private readonly deleteClassUseCase:      DeleteClassUseCase;
    private readonly createSubjectUseCase:    CreateSubjectUseCase;
    private readonly getSubjectsUseCase:      GetSubjectsUseCase;
    private readonly assignSubjectUseCase:    AssignSubjectUseCase;
    private readonly getClassSubjectsUseCase: GetClassSubjectsUseCase;
    private readonly removeSubjectUseCase:    RemoveSubjectUseCase;

    constructor({
        createClassUseCase,
        updateClassUseCase,
        getClassesUseCase,
        getClassByIdUseCase,
        setClassTeacherUseCase,
        deleteClassUseCase,
        createSubjectUseCase,
        getSubjectsUseCase,
        assignSubjectUseCase,
        getClassSubjectsUseCase,
        removeSubjectUseCase,
    }: Dependencies) {
        this.createClassUseCase      = createClassUseCase;
        this.updateClassUseCase      = updateClassUseCase;
        this.getClassesUseCase       = getClassesUseCase;
        this.getClassByIdUseCase     = getClassByIdUseCase;
        this.setClassTeacherUseCase  = setClassTeacherUseCase;
        this.deleteClassUseCase      = deleteClassUseCase;
        this.createSubjectUseCase    = createSubjectUseCase;
        this.getSubjectsUseCase      = getSubjectsUseCase;
        this.assignSubjectUseCase    = assignSubjectUseCase;
        this.getClassSubjectsUseCase = getClassSubjectsUseCase;
        this.removeSubjectUseCase    = removeSubjectUseCase;
    }

    // ── Classes ───────────────────────────────────────────────────────────
    getClasses = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { termId } = req.query;

            const result = await this.getClassesUseCase.execute(
                termId as string,
            );

            sendSuccess(res, result, "Classes retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    createClass = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createClassUseCase.execute(req.body);
            sendCreated(res, result, "Class created successfully");
        } catch (err) { next(err); }
    };

    getClassById = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        const result = await this.getClassByIdUseCase.execute(
            req.params?.id as string
        )
        sendSuccess(res, result, "class retrieved successful" )
    }

    setClassTeacher = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.setClassTeacherUseCase.execute(
                req.params.id as string,
                req.body.staffId ?? null,
            );

            sendSuccess(
                res,
                result,
                "Class teacher updated successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    updateClass = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateClassUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Class updated successfully");
        } catch (err) { next(err); }
    };

    deleteClass = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deleteClassUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Class deleted successfully");
        } catch (err) { next(err); }
    };

    // ── Subjects ──────────────────────────────────────────────────────────
    getSubjects = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSubjectsUseCase.execute();
            sendSuccess(res, result, "Subjects retrieved successfully");
        } catch (err) { next(err); }
    };

    createSubject = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createSubjectUseCase.execute(req.body);
            sendCreated(res, result, "Subject created successfully");
        } catch (err) { next(err); }
    };

    // ── Class Subjects ────────────────────────────────────────────────────
    getClassSubjects = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getClassSubjectsUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Class subjects retrieved successfully");
        } catch (err) { next(err); }
    };

    assignSubject = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.assignSubjectUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendCreated(res, result, "Subject assigned successfully");
        } catch (err) { next(err); }
    };

    removeSubject = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            await this.removeSubjectUseCase.execute(
                req.params.classSubjectId as string,
            );
            sendSuccess(res, null, "Subject removed successfully");
        } catch (err) { next(err); }
    };
}