import { Types } from "mongoose";

export enum BillType {
    SCHOOL_FEE = "SCHOOL_FEE",
    LESSON_FEE = "LESSON_FEE",
    BUS_FEE = "BUS_FEE",
    OTHER = "OTHER"
}

export interface IBill {
    school: Types.ObjectId;
    title: string;          
    type: BillType;
    amount: number;
    class?: Types.ObjectId;  
    term?: string;           
    academicYear?: string;
    students?: Types.ObjectId[]; 
    dueDate?: Date;
    isActive: boolean;
}
