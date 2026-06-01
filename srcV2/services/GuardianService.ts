import { Types } from "mongoose";
import Guardian, { IGuardianDocument } from "../infrastructure/database/models/Guardian";
import { AppError } from "../shared/errors/AppError";
import { RelationshipType } from "../shared/types/Guardian";
import User from "../infrastructure/database/models/user.model";
import { UserRole } from "../domain/enums/user-role";

export class GuardianService {

	/* ===========================
	   Create Guardian Profile
	   (called after user creation)
	=========================== */
	static async createGuardianProfile(params: {
		userId: Types.ObjectId;
		schoolId: Types.ObjectId;
	}): Promise<IGuardianDocument> {

		const user = await User.findById(params.userId);

		if (!user) {
			throw new AppError("User not found", 404);
		}

		if (user.role !== UserRole.GUARDIAN) {
			throw new AppError("User is not a guardian", 400);
		}

		if (!user.school.equals(params.schoolId)) {
			throw new AppError("User does not belong to this school", 403);
		}

		const existing = await Guardian.findOne({ user: params.userId });
		if (existing) {
			throw new AppError("Guardian profile already exists", 409);
		}

		const guardian = new Guardian({
			user: params.userId,
			school: params.schoolId
		});

		return guardian.save();
	}

	/* ===========================
	   Get Guardian By User (ME)
	=========================== */
	static async getGuardianByUser(
		userId: Types.ObjectId,
		schoolId: Types.ObjectId
	): Promise<IGuardianDocument> {

		const guardian = await Guardian.findOne({
			user: userId,
			school: schoolId,
			isActive: true
		})
			.populate("user", "firstName lastName email phone")
			.populate("relations.student");

		if (!guardian) {
			throw new AppError("Guardian profile not found", 404);
		}

		return guardian;
	}

	/* ===========================
	   Link Student to Guardian
	=========================== */
	static async linkStudent(params: {
		userId: Types.ObjectId;
		schoolId: Types.ObjectId;
		studentId: Types.ObjectId;
		relationship: RelationshipType;
	}): Promise<IGuardianDocument> {

		const guardian = await Guardian.findOne({
			user: params.userId,
			school: params.schoolId,
			isActive: true
		});

		if (!guardian) {
			throw new AppError("Guardian profile not found", 404);
		}

		const alreadyLinked = guardian.relations.some(
			r => r.student.equals(params.studentId)
		);

		if (alreadyLinked) {
			throw new AppError("Student already linked to guardian", 409);
		}

		guardian.relations.push({
			student: params.studentId,
			type: params.relationship
		});

		await guardian.save();

		return guardian;
	}

	/* ===========================
	   Unlink Student
	=========================== */
	static async unlinkStudent(params: {
		userId: Types.ObjectId;
		schoolId: Types.ObjectId;
		studentId: Types.ObjectId;
	}): Promise<IGuardianDocument> {

		const guardian = await Guardian.findOne({
			user: params.userId,
			school: params.schoolId,
			isActive: true
		});

		if (!guardian) {
			throw new AppError("Guardian profile not found", 404);
		}

		guardian.relations = guardian.relations.filter(
			r => !r.student.equals(params.studentId)
		);

		await guardian.save();

		return guardian;
	}

	/* ===========================
	   Get Guardian Students
	=========================== */
	static async getGuardianStudents(
		userId: Types.ObjectId,
		schoolId: Types.ObjectId
	) {

		const guardian = await Guardian.findOne({
			user: userId,
			school: schoolId,
			isActive: true
		})
			.populate("relations.student");

		if (!guardian) {
			throw new AppError("Guardian profile not found", 404);
		}

		return guardian.relations;
	}

	/* ===========================
	   Deactivate Guardian Profile
	   (soft delete)
	=========================== */
	static async deactivateGuardian(
		userId: Types.ObjectId,
		schoolId: Types.ObjectId
	): Promise<IGuardianDocument> {

		const guardian = await Guardian.findOneAndUpdate(
			{
				user: userId,
				school: schoolId
			},
			{ isActive: false },
			{ new: true }
		);

		if (!guardian) {
			throw new AppError("Guardian profile not found", 404);
		}

		return guardian;
	}
}
