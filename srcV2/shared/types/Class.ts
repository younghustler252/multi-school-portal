import { Types } from "mongoose";

export interface IClass {
    school: Types.ObjectId;
    name: string;          
    term: string;          // e.g., "Term 1", "Term 2"
    academicYear: string;  // e.g., "2025/2026"
    students: Types.ObjectId[]; // optional for fast lookup
    teachers: Types.ObjectId[];
    isActive: boolean;
}