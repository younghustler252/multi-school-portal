import { Request, Response, NextFunction } from "express";
import { CreateStudentUseCase }      from "../usecases/create-student.usecase";
import { GetStudentUseCase }         from "../usecases/get-student.usecase";
import { ListStudentsUseCase }       from "../usecases/list-students.usecase";
import { UpdateStudentUseCase }      from "../usecases/update-student.usecase";
import { DeactivateStudentUseCase }  from "../usecases/deactivate-student.usecase";
import { UploadStudentPhotoUseCase } from "../usecases/upload-photo.usecase";
import { GetStudentsBatchUseCase } from "../usecases/get-students-batch.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                    from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| STUDENT CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createStudentUseCase:      CreateStudentUseCase;
    getStudentUseCase:         GetStudentUseCase;
    listStudentsUseCase:       ListStudentsUseCase;
    updateStudentUseCase:      UpdateStudentUseCase;
    deactivateStudentUseCase:  DeactivateStudentUseCase;
    uploadStudentPhotoUseCase: UploadStudentPhotoUseCase;
    getStudentsBatchUseCase:   GetStudentsBatchUseCase;

}

export class StudentController {
    private readonly createStudentUseCase:      CreateStudentUseCase;
    private readonly getStudentUseCase:         GetStudentUseCase;
    private readonly listStudentsUseCase:       ListStudentsUseCase;
    private readonly updateStudentUseCase:      UpdateStudentUseCase;
    private readonly deactivateStudentUseCase:  DeactivateStudentUseCase;
    private readonly uploadStudentPhotoUseCase: UploadStudentPhotoUseCase;
    private readonly getStudentsBatchUseCase:   GetStudentsBatchUseCase;

    constructor({
        createStudentUseCase,
        getStudentUseCase,
        listStudentsUseCase,
        updateStudentUseCase,
        deactivateStudentUseCase,
        uploadStudentPhotoUseCase,
        getStudentsBatchUseCase
    }: Dependencies) {
        this.createStudentUseCase      = createStudentUseCase;
        this.getStudentUseCase         = getStudentUseCase;
        this.listStudentsUseCase       = listStudentsUseCase;
        this.updateStudentUseCase      = updateStudentUseCase;
        this.deactivateStudentUseCase  = deactivateStudentUseCase;
        this.uploadStudentPhotoUseCase = uploadStudentPhotoUseCase ;
        this.getStudentsBatchUseCase   = getStudentsBatchUseCase;
    }

    // ── List students ─────────────────────────────────────────────────────
    listStudents = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.listStudentsUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };

    // ── Get student ───────────────────────────────────────────────────────
    getStudent = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getStudentUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Student retrieved successfully");
            
        } catch (err) {
            next(err);
        }
    };

    // ── Create student ────────────────────────────────────────────────────
    createStudent = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createStudentUseCase.execute(req.body);
            sendCreated(res, result, "Student created successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Update student ────────────────────────────────────────────────────
    updateStudent = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateStudentUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Student updated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Deactivate student ────────────────────────────────────────────────
    deactivateStudent = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deactivateStudentUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Student deactivated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Upload photo ──────────────────────────────────────────────────────
    uploadPhoto = async (
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

            const result = await this.uploadStudentPhotoUseCase.execute(
                req.params.id as string,
                req.user!.schoolId!,
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendSuccess(res, result, "Photo uploaded successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Get students batch ────────────────────────────────────────────────────
    getStudentsBatch = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getStudentsBatchUseCase.execute(req.body.ids);
            sendSuccess(res, result, "Students retrieved successfully");
        } catch (err) {
            next(err);
        }
    };
}