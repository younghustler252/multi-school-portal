import { Types } from "mongoose"

export enum AttendanceStatus {
    PRESENT = "PRESENT",
    ABSENT = "ABSENT",
    LATE = "LATE"
}

export interface IAttendance {
    student: Types.ObjectId;
    class: Types.ObjectId;
    date: Date;
    status: AttendanceStatus;
}