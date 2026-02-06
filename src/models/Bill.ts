import { Schema, Document, Types, model } from "mongoose";
import { IBill, BillType } from "../types/Bill";

export interface IBillDocument extends IBill, Document {}


const BillSchema = new Schema<IBillDocument>({
    school: { 
        type: 
        Schema.Types.ObjectId, 
        ref: "School", 
        required: true 
    },
    title: { 
        type: String, 
        required: true },
    type: { 
        type: String, 
        enum: Object.values(BillType), 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    class: { 
        type: Schema.Types.ObjectId, 
        ref: "Class" 
    },
    term: String,
    academicYear: String,
    students: [
        { 
            type: Schema.Types.ObjectId, 
            ref: "User" 
        }
    ],

    dueDate: Date,
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

export default model<IBillDocument>("Bill", BillSchema);