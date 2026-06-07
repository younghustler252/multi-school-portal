// school.model.ts
import mongoose from "mongoose";
import { SchoolSchema } from "./school.schema";
import { SchoolDocument } from "./school.document";

export const SchoolModel = mongoose.model<SchoolDocument>(
  "School",
  SchoolSchema
);