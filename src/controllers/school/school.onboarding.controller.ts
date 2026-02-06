import { Request, Response } from "express";
import { Types } from "mongoose";
import asyncHandler from "express-async-handler";
import { ISchoolDocument } from "../../models/School";
import { SchoolService } from "../../services/schoolService";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/response";
import { VerificationDocumentType, VerificationStatus, SchoolType, SubscriptionPlan } from "../../types/School";


/* ===========================
   Complete School Profile (onboarding)
=========================== */
export const completeSchoolProfile = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new AppError("Unauthorized", 401);

    const { name, schoolType, subscriptionPlan, address, contactEmail, logoUrl, timezone } = req.body;

    if (!name || !schoolType || !Object.values(SchoolType).includes(schoolType)) {
        throw new AppError("Name and valid schoolType are required", 400);
    }

    const school = await SchoolService.getSchoolByTenantId(tenantId);

    school.name = name;
    school.schoolType = schoolType;
    school.subscriptionPlan = subscriptionPlan && Object.values(SubscriptionPlan).includes(subscriptionPlan)
        ? subscriptionPlan
        : SubscriptionPlan.FREE;
    school.address = address ?? school.address;
    school.contactEmail = contactEmail ?? school.contactEmail;
    school.logoUrl = logoUrl ?? school.logoUrl;
    school.timezone = timezone ?? school.timezone;

    // Mark profile complete
    const requiredFields: Array<keyof ISchoolDocument> = ["name", "address", "contactEmail", "schoolType"];
    school.isProfileComplete = requiredFields.every(field => !!school[field]);

    await school.save();

    await SchoolService.tryActivateSchool(school);

    sendSuccess(res, school, 200, "School profile completed successfully");
});


/* ===========================
   Upload Verification Document
=========================== */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new AppError("Unauthorized", 401);

    const { documentType, fileUrl } = req.body;

    if (!documentType || !fileUrl) throw new AppError("documentType and fileUrl are required", 400);

    if (!Object.values(VerificationDocumentType).includes(documentType)) {
        throw new AppError("Invalid document type", 400);
    }

    const school = await SchoolService.getSchoolByTenantId(tenantId);

    school.verificationDocuments.push({
        _id: new Types.ObjectId(),
        documentType: documentType as VerificationDocumentType,
        fileUrl,
        status: VerificationStatus.PENDING
    });

    await school.save();

    sendSuccess(res, school, 200, "Document uploaded successfully");
});

// Admin endpoint

export const reviewVerificationDocument = asyncHandler(
	async (req: Request, res: Response) => {
		const {
			schoolId,
			documentId,
			status,
			rejectionReason
		} = req.body;

		const adminId = req.auth?.userId;

		/* ─────────────── AUTH CHECK ─────────────── */
		if (!adminId) {
			throw new AppError("Unauthorized", 401);
		}

		/* ─────────────── INPUT VALIDATION ─────────────── */
		if (!schoolId || !documentId || !status) {
			throw new AppError(
				"schoolId, documentId and status are required",
				400
			);
		}

		if (
			![
				VerificationStatus.APPROVED,
				VerificationStatus.REJECTED
			].includes(status)
		) {
			throw new AppError("Invalid verification status", 400);
		}

		/* ─────────────── FETCH SCHOOL ─────────────── */
		const school = await SchoolService.getSchoolById(schoolId);
		
		/* ─────────────── FIND DOCUMENT ─────────────── */
		const document = school.verificationDocuments.find(
			doc => doc._id?.toString() === documentId
		);

		if (!document) {
			throw new AppError("Verification document not found", 404);
		}

		/* ─────────────── UPDATE DOCUMENT ─────────────── */
		document.status = status;
		document.verifiedAt = new Date();
		document.verifiedBy = new Types.ObjectId(adminId);

		if (status === VerificationStatus.REJECTED) {
			if (!rejectionReason) {
				throw new AppError(
					"Rejection reason is required",
					400
				);
			}

			document.rejectionReason = rejectionReason;
		}


		/* ─────────────── UPDATE SCHOOL STATUS ─────────────── */
		const allDocumentsApproved =
			school.verificationDocuments.length > 0 &&
			school.verificationDocuments.every(
				doc => doc.status === VerificationStatus.APPROVED
			);

		school.verificationStatus = allDocumentsApproved
			? VerificationStatus.APPROVED
			: VerificationStatus.PENDING;

		await school.save();

        await SchoolService.tryActivateSchool(school);

		/* ─────────────── RESPONSE ─────────────── */
		sendSuccess(
			res,
			school,
			200,
			"Document reviewed successfully"
		);
	}
);
