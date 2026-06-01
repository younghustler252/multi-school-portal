import { Schema, model, Types } from "mongoose";
import { AttendanceStatus, IAttendance } from "../../../shared/types/Attendance";

export interface IAttendanceDocument extends IAttendance, Document {}


const AttendanceSchema = new Schema<IAttendanceDocument>({
    student: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    class: { 
        type: Schema.Types.ObjectId, 
        ref: "Class", 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    status: { 
        type: String, 
        enum: Object.values(AttendanceStatus), 
        required: true 
    }
}, { timestamps: true });

export default model<IAttendanceDocument>("Attendance", AttendanceSchema);
