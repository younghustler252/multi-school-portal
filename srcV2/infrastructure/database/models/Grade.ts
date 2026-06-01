import { Schema, Document, Types, model } from "mongoose";
import { IGrade } from "../../../shared/types/Grade";

export interface IGradeDocument extends IGrade, Document {}


const GradeSchema = new Schema<IGradeDocument>({
    student: { 
        type: Schema.Types.ObjectId, 
        ref: "User", required: true 
    },
    class: { 
        type: Schema.Types.ObjectId, 
        ref: "Class", 
        required: true 

    },
    subject: { 
        type: String, 
        required: true 
    },
    score: { 
        type: Number, 
        required: true 
    },
    maxScore: { 
        type: Number, 
        required: true 
    },
    term: { type: String, 
        required: true 
    },
    academicYear: { 
        type: String, 
        required: true 
    }
}, { timestamps: true });

export default model<IGradeDocument>("Grade", GradeSchema);