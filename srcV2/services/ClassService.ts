// services/ClassService.ts
import { Types } from "mongoose";
import Class, { IClassDocument } from "../infrastructure/database/models/Class";
import User from "../infrastructure/database/models/user.model";
import { UserRole } from "../domain/enums/user-role";
import { AppError } from "../shared/errors/AppError";

export class ClassService {

    /* =======================
       Create Class
    ======================= */
    static async createClass({
        schoolId,
        name,
        term,
        academicYear
    }: {
        schoolId: Types.ObjectId;
        name: string;
        term: string;
        academicYear: string;
    }): Promise<IClassDocument> {

        const existing = await Class.findOne({
            school: schoolId,
            name,
            term,
            academicYear
        });

        if (existing) {
            throw new AppError("Class already exists for this term and academic year", 400);
        }

        const newClass = await Class.create({
            school: schoolId,
            name,
            term,
            academicYear
        });

        return newClass;
    }

    /* =======================
       Fetchers
    ======================= */
    static async getClassesBySchool(
        schoolId: Types.ObjectId,
        filter?: {
            term?: string;
            academicYear?: string;
            isActive?: boolean;
        }
    ) {
        return Class.find({
            school: schoolId,
            ...filter
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    static async getClassById(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId
    ): Promise<IClassDocument> {

        const cls = await Class.findOne({ _id: classId, school: schoolId });
        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    /* =======================
       Assign Students
    ======================= */
    static async addStudentsToClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId,
        studentIds: Types.ObjectId[]
    ): Promise<IClassDocument> {

        const students = await User.find({
            _id: { $in: studentIds },
            school: schoolId,
            role: UserRole.STUDENT
        });

        if (students.length !== studentIds.length) {
            throw new AppError("One or more students are invalid", 400);
        }

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { $addToSet: { students: { $each: studentIds } } },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    static async removeStudentFromClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId,
        studentId: Types.ObjectId
    ): Promise<IClassDocument> {

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { $pull: { students: studentId } },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    /* =======================
       Assign Teachers
    ======================= */
    static async addTeachersToClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId,
        teacherIds: Types.ObjectId[]
    ): Promise<IClassDocument> {

        const teachers = await User.find({
            _id: { $in: teacherIds },
            school: schoolId,
            role: UserRole.TEACHER
        });

        if (teachers.length !== teacherIds.length) {
            throw new AppError("One or more teachers are invalid", 400);
        }

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { $addToSet: { teachers: { $each: teacherIds } } },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    static async removeTeacherFromClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId,
        teacherId: Types.ObjectId
    ): Promise<IClassDocument> {

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { $pull: { teachers: teacherId } },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    /* =======================
       Activation
    ======================= */
    static async deactivateClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId
    ): Promise<IClassDocument> {

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { isActive: false },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }

    static async activateClass(
        classId: Types.ObjectId,
        schoolId: Types.ObjectId
    ): Promise<IClassDocument> {

        const cls = await Class.findOneAndUpdate(
            { _id: classId, school: schoolId },
            { isActive: true },
            { new: true }
        );

        if (!cls) throw new AppError("Class not found", 404);
        return cls;
    }
}
