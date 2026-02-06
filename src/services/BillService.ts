// services/BillService.ts
import { Types } from "mongoose";
import Bill, { IBillDocument } from "../models/Bill";
import { BillType } from "../types/Bill";
import Class from "../models/Class";
import User from "../models/User";
import { UserRole } from "../types/UserRole";
import { AppError } from "../utils/AppError";

export class BillService {

    /* =======================
       Create Bill
    ======================= */
    static async createBill({
        schoolId,
        title,
        type,
        amount,
        academicYear,
        term,
        classId,
        studentIds,
        dueDate
    }: {
        schoolId: Types.ObjectId;
        title: string;
        type: BillType;
        amount: number;
        academicYear: string;
        term?: string;
        classId?: Types.ObjectId;
        studentIds?: Types.ObjectId[];
        dueDate?: Date;
    }): Promise<IBillDocument> {

        if (classId && studentIds?.length) {
            throw new AppError("Bill cannot be assigned to both class and students", 400);
        }

        if (classId) {
            const cls = await Class.findOne({ _id: classId, school: schoolId });
            if (!cls) throw new AppError("Class not found", 404);
        }

        if (studentIds?.length) {
            const students = await User.find({
                _id: { $in: studentIds },
                school: schoolId,
                role: UserRole.STUDENT
            });

            if (students.length !== studentIds.length) {
                throw new AppError("One or more students are invalid", 400);
            }
        }

        return Bill.create({
            school: schoolId,
            title,
            type,
            amount,
            academicYear,
            term,
            class: classId,
            students: studentIds,
            dueDate
        });
    }

    /* =======================
       Fetch Bills
    ======================= */

    // Bills applicable to a specific student
    static async getBillsForStudent(
        schoolId: Types.ObjectId,
        studentId: Types.ObjectId,
        classId?: Types.ObjectId
    ) {
        return Bill.find({
            school: schoolId,
            isActive: true,
            $or: [
                { students: studentId },
                { class: classId },
                { class: { $exists: false }, students: { $exists: false } }
            ]
        })
        .sort({ dueDate: 1 })
        .lean();
    }

    // Bills for a class
    static async getBillsForClass(
        schoolId: Types.ObjectId,
        classId: Types.ObjectId
    ) {
        return Bill.find({
            school: schoolId,
            class: classId,
            isActive: true
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Bills created by a school
    static async getAllBillsBySchool(
        schoolId: Types.ObjectId,
        filters?: {
            academicYear?: string;
            term?: string;
            type?: BillType;
            isActive?: boolean;
        }
    ) {
        return Bill.find({
            school: schoolId,
            ...filters
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    /* =======================
       Activation
    ======================= */
    static async deactivateBill(
        billId: Types.ObjectId,
        schoolId: Types.ObjectId
    ): Promise<IBillDocument> {

        const bill = await Bill.findOneAndUpdate(
            { _id: billId, school: schoolId },
            { isActive: false },
            { new: true }
        );

        if (!bill) throw new AppError("Bill not found", 404);
        return bill;
    }

    static async activateBill(
        billId: Types.ObjectId,
        schoolId: Types.ObjectId
    ): Promise<IBillDocument> {

        const bill = await Bill.findOneAndUpdate(
            { _id: billId, school: schoolId },
            { isActive: true },
            { new: true }
        );

        if (!bill) throw new AppError("Bill not found", 404);
        return bill;
    }
}
