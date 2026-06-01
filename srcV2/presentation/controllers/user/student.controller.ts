import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../../shared/errors/AppError";
import School from "../../../infrastructure/database/models/school.model";
import { sendSuccess } from "../../../shared/utils/response";
import { SchoolService } from "../../../services/schoolService";