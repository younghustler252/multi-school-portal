import { Request, Response, NextFunction } from "express";
import { CreateClassUseCase }       from "../usecases/school-admin/create-class.usecase";
import { UpdateClassUseCase }       from "../usecases/school-admin/update-class.usecase";
import { GetClassesUseCase }        from "../usecases/school-admin/get-classes.usecase";
import { SetClassTeacherUseCase } from "../usecases/school-admin/set-classteacher.usecase";
import { GetClassByIdUseCase } from "../usecases/school-admin/get-class-by-id.usecase";
import { CreateSubjectUseCase }     from "../usecases/school-admin/create-subject.usecase";
import { DeleteClassUseCase } from "../usecases/school-admin/delete-class.usecase";
import { UpdateSubjectUseCase }     from "../usecases/school-admin/update-subject.usecase";
import { GetSubjectsUseCase }       from "../usecases/school-admin/get-subjects.usecase";
import { AssignSubjectUseCase }     from "../usecases/school-admin/assign-subject.usecase";
import { SetSubjectDefaultTeacherUseCase } from "../usecases/school-admin/set-subject-default-teacher.usecase";
import { BulkAssignSubjectsUseCase } from "../usecases/school-admin/bulk-assign-subject.usecase";
import { GetClassSubjectsUseCase }  from "../usecases/school-admin/get-class-subjects.usecase";
import { RemoveSubjectUseCase }     from "../usecases/school-admin/remove-subject.usecase";
import { ApplyDefaultsUseCase } from "../usecases/school-admin/apply-default-usecase";
import { SetClassProgressionUseCase } from "../usecases/school-admin/set-class-progression.usecase";
import { ClearSubjectOverrideUseCase } from "../usecases/school-admin/clear-subject-override.usecase";
import { classErrors } from "../domain/class.errors";
import { ClassActor } from "../domain/class.types";
import {
    sendSuccess,
    sendCreated,
}                                   from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| CLASS CONTROLLER
|--------------------------------------------------------------------------
*/

// The school is the host's school; the acting person comes ONLY from the verified session (req.auth).
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request): ClassActor => {
    if (!req.auth) throw classErrors.notFound();
    return { userId: req.auth.userId };
};

interface Dependencies {
    createClassUseCase:      CreateClassUseCase;
    updateClassUseCase:      UpdateClassUseCase;
    getClassesUseCase:       GetClassesUseCase;
    getClassByIdUseCase:     GetClassByIdUseCase;
    deleteClassUseCase:      DeleteClassUseCase;
    createSubjectUseCase:    CreateSubjectUseCase;
    getSubjectsUseCase:      GetSubjectsUseCase;
    updateSubjectUseCase:    UpdateSubjectUseCase;
    assignSubjectUseCase:    AssignSubjectUseCase;
    setSubjectDefaultTeacherUseCase: SetSubjectDefaultTeacherUseCase;
    bulkAssignSubjectsUseCase: BulkAssignSubjectsUseCase;
    getClassSubjectsUseCase: GetClassSubjectsUseCase;
    removeSubjectUseCase:    RemoveSubjectUseCase;
    setClassTeacherUseCase:  SetClassTeacherUseCase;
    setClassProgressionUseCase: SetClassProgressionUseCase;
    applyDefaultsUseCase:        ApplyDefaultsUseCase;
    clearSubjectOverrideUseCase:    ClearSubjectOverrideUseCase;
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
    private readonly updateSubjectUseCase:    UpdateSubjectUseCase;
    private readonly assignSubjectUseCase:    AssignSubjectUseCase;
    private readonly setSubjectDefaultTeacherUseCase: SetSubjectDefaultTeacherUseCase;
    private readonly bulkAssignSubjectsUseCase: BulkAssignSubjectsUseCase;
    private readonly getClassSubjectsUseCase: GetClassSubjectsUseCase;
    private readonly removeSubjectUseCase:    RemoveSubjectUseCase;
    private readonly setClassProgressionUseCase: SetClassProgressionUseCase;
    private readonly applyDefaultsUseCase:       ApplyDefaultsUseCase;
    private readonly clearSubjectOverrideUseCase:   ClearSubjectOverrideUseCase;

    constructor({
        createClassUseCase,
        updateClassUseCase,
        getClassesUseCase,
        getClassByIdUseCase,
        setClassTeacherUseCase,
        deleteClassUseCase,
        createSubjectUseCase,
        getSubjectsUseCase,
        updateSubjectUseCase,
        assignSubjectUseCase,
        setSubjectDefaultTeacherUseCase,
        bulkAssignSubjectsUseCase,
        getClassSubjectsUseCase,
        removeSubjectUseCase,
        setClassProgressionUseCase,
        applyDefaultsUseCase,
        clearSubjectOverrideUseCase,
    }: Dependencies) {
        this.createClassUseCase         = createClassUseCase;
        this.updateClassUseCase         = updateClassUseCase;
        this.getClassesUseCase          = getClassesUseCase;
        this.getClassByIdUseCase        = getClassByIdUseCase;
        this.setClassTeacherUseCase     = setClassTeacherUseCase;
        this.deleteClassUseCase         = deleteClassUseCase;
        this.createSubjectUseCase       = createSubjectUseCase;
        this.getSubjectsUseCase         = getSubjectsUseCase;
        this.updateSubjectUseCase       = updateSubjectUseCase;
        this.assignSubjectUseCase       = assignSubjectUseCase;
        this.setSubjectDefaultTeacherUseCase = setSubjectDefaultTeacherUseCase;
        this.bulkAssignSubjectsUseCase  = bulkAssignSubjectsUseCase,
        this.getClassSubjectsUseCase    = getClassSubjectsUseCase;
        this.removeSubjectUseCase       = removeSubjectUseCase;
        this.setClassProgressionUseCase = setClassProgressionUseCase;
        this.applyDefaultsUseCase       = applyDefaultsUseCase;
        this.clearSubjectOverrideUseCase= clearSubjectOverrideUseCase;
    }

    // ── Classes ───────────────────────────────────────────────────────────
    getClasses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
            sendSuccess(res, await this.getClassesUseCase.execute(termId), "Classes retrieved successfully");
        } catch (err) { next(err); }
    };

    createClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendCreated(res, await this.createClassUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Class created successfully"); }
        catch (err) { next(err); }
    };

    getClassById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
            sendSuccess(res, await this.getClassByIdUseCase.execute(String(req.params.id), termId), "Class retrieved successfully");
        } catch (err) { next(err); }
    };

    setClassTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.setClassTeacherUseCase.execute(schoolIdOf(req), String(req.params.id), req.body.staffId, actorOf(req)), "Class teacher updated successfully"); }
        catch (err) { next(err); }
    };

    updateClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.updateClassUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, actorOf(req)), "Class updated successfully"); }
        catch (err) { next(err); }
    };

    deleteClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.deleteClassUseCase.execute(schoolIdOf(req), String(req.params.id), actorOf(req)), "Class deleted successfully"); }
        catch (err) { next(err); }
    };

    // ── Subjects ──────────────────────────────────────────────────────────
    updateSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.updateSubjectUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, actorOf(req)), "Subject updated successfully"); }
        catch (err) { next(err); }
    };

    getSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.getSubjectsUseCase.execute(), "Subjects retrieved successfully"); }
        catch (err) { next(err); }
    };

    createSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendCreated(res, await this.createSubjectUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Subject created successfully"); }
        catch (err) { next(err); }
    };

    // ── Class Subjects ────────────────────────────────────────────────────
    getClassSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
            sendSuccess(res, await this.getClassSubjectsUseCase.execute(String(req.params.id), termId), "Class subjects retrieved successfully");
        } catch (err) { next(err); }
    };

    assignSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendCreated(res, await this.assignSubjectUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, actorOf(req)), "Subject assigned successfully"); }
        catch (err) { next(err); }
    };

    setSubjectDefaultTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.setSubjectDefaultTeacherUseCase.execute(schoolIdOf(req), String(req.params.id), req.body.staffId, actorOf(req)), "Subject default teacher updated successfully"); }
        catch (err) { next(err); }
    };

    bulkAssignSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.bulkAssignSubjectsUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, actorOf(req)), "Subjects assigned successfully"); }
        catch (err) { next(err); }
    };

    removeSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.removeSubjectUseCase.execute(schoolIdOf(req), String(req.params.classSubjectId), actorOf(req)), "Subject removed from class"); }
        catch (err) { next(err); }
    };

    setClassProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.setClassProgressionUseCase.execute(schoolIdOf(req), String(req.params.id), req.body.toClassId ?? null, actorOf(req)), "Class progression updated successfully"); }
        catch (err) { next(err); }
    };

    applyTeachingDefaults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.applyDefaultsUseCase.execute(schoolIdOf(req), actorOf(req)), "Teaching defaults applied"); }
        catch (err) { next(err); }
    };

    clearSubjectOverride = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try { sendSuccess(res, await this.clearSubjectOverrideUseCase.execute(schoolIdOf(req), String(req.params.classSubjectId), actorOf(req)), "Teacher override cleared"); }
        catch (err) { next(err); }
    };

}