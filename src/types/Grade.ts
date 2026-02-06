import { Types } from "mongoose";

export interface IGrade {
    student: Types.ObjectId;
    class: Types.ObjectId;
    subject: string;
    score: number;
    maxScore: number;
    term: string;
    academicYear: string;
}
