import { Request, Response, NextFunction } from "express";
import { CreateStudentUseCase } from "../usecases/create-student.usecase";
import { UpdateStudentUseCase } from "../usecases/update-student.usecase";
import { DeactivateStudentUseCase } from "../usecases/deactivate-student.usecase";
import { ReactivateStudentUseCase } from "../usecases/reactivate-student.usecase";
import { UndoGraduationUseCase } from "../usecases/undo-graduation.usecase";
import { ListStudentsUseCase, GetStudentUseCase, GetMyStudentProfileUseCase } from "../usecases/student-queries.usecases";
import { UploadStudentPhotoUseCase } from "../usecases/upload-photo.usecase";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { ListStudentsQuery } from "../dtos/student.dto";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";

interface Dependencies {
    listStudentsUseCase: ListStudentsUseCase; getStudentUseCase: GetStudentUseCase; getMyStudentProfileUseCase: GetMyStudentProfileUseCase;
    createStudentUseCase: CreateStudentUseCase; updateStudentUseCase: UpdateStudentUseCase;
    deactivateStudentUseCase: DeactivateStudentUseCase; reactivateStudentUseCase: ReactivateStudentUseCase;
    undoGraduationUseCase: UndoGraduationUseCase;
    uploadStudentPhotoUseCase: UploadStudentPhotoUseCase;
}

/*
| STUDENT CONTROLLER (school realm, /students). The school is the host's school; the acting person comes ONLY
| from the verified session (req.auth), never from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const idOf = (req: Request): string => String(req.params.id);
const actorOf = (req: Request): StudentActor => {
    if (!req.auth) throw studentErrors.notFound();
    return { userId: req.auth.userId };
};

export class StudentController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // The validate middleware does not write query values back, so the query is parsed here
            const r = await this.d.listStudentsUseCase.execute(ListStudentsQuery.parse(req.query), getAccess(req));
            res.status(200).json({ success: true, message: "Students retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    get    = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getStudentUseCase.execute(idOf(req), getAccess(req)), "Student retrieved successfully"); } catch (e) { next(e); } };
    me     = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyStudentProfileUseCase.execute(getAccess(req)), "Profile retrieved successfully"); } catch (e) { next(e); } };
    create = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createStudentUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Student created successfully"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateStudentUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Student updated successfully"); } catch (e) { next(e); } };
    deactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deactivateStudentUseCase.execute(schoolIdOf(req), idOf(req), req.body ?? {}, actorOf(req)), "Student deactivated successfully"); } catch (e) { next(e); } };
    reactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.reactivateStudentUseCase.execute(schoolIdOf(req), idOf(req), actorOf(req)), "Student reactivated successfully"); } catch (e) { next(e); } };
    undoGraduation = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.undoGraduationUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Graduation undone"); } catch (e) { next(e); } };

    uploadPhoto = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) throw studentErrors.noPhotoFile();
            sendSuccess(res, await this.d.uploadStudentPhotoUseCase.execute(schoolIdOf(req), idOf(req), { buffer: req.file.buffer }, actorOf(req)), "Photo uploaded successfully");
        } catch (e) { next(e); }
    };
}
