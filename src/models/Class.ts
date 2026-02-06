import { Schema, Document, Types, model } from "mongoose";
import { IClass } from "../types/Class";

export interface IClassDocument extends IClass, Document {}

const ClassSchema = new Schema <IClassDocument>({
    school: { 
        type: Schema.Types.ObjectId, 
        ref: "School", 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    term: { 
        type: String, 
        required: true 
    },
    academicYear: { 
        type: String, 
        required: true 
    },
    students: [
        { 
            type: Schema.Types.ObjectId,
            ref: "User" 
        }
    ],
    teachers: [
        { 
            type: Schema.Types.ObjectId, 
            ref: "User" 
        }
    ],
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

ClassSchema.index(
    { school: 1, name: 1, term: 1, academicYear: 1 },
    { unique: true }
);



export default model<IClassDocument>("Class", ClassSchema);