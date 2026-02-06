import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../utils/AppError";
import School from "../../models/School";
import { sendSuccess } from "../../utils/response";
import { SchoolService } from "../../services/schoolService";