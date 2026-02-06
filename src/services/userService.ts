// services/userService.ts
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import User, { IUserDocument } from "../models/User";
import { UserRole } from "../types/UserRole";
import { AppError } from "../utils/AppError";


export class UserService {

	/* =======================
	   Create User
	======================== */
	static async createUser({
		schoolId,
		role,
		firstName,
		lastName,
		email,
		password
	}: {
		schoolId: Types.ObjectId;
		role: UserRole;
		firstName: string;
		lastName: string;
		email: string;
		password?: string;
	}): Promise<IUserDocument> {

		// Check if user already exists in this school
		const existing = await User.findOne({ email: email.toLowerCase(), school: schoolId });
		if (existing) {
			throw new AppError(
				"User with this email already exists in your school",
				400
			);
		}

		// Auto-generate password if not provided
		const plainPassword = password || Math.random().toString(36).slice(-8);

		// Hash password
		const hashedPassword = await bcrypt.hash(plainPassword, 12);

		// Create the user
		const user = new User({
			school: schoolId,
			role,
			firstName,
			lastName,
			email: email.toLowerCase(),
			passwordHash: hashedPassword
		});

		await user.save();

		return user.toObject();
	}


    static async findByEmail(
        email: string,
        schoolId: Types.ObjectId
    ): Promise<IUserDocument | null> {
        return User.findOne({ email: email.toLowerCase(), school: schoolId });
    }

    static async verifyPassword(
        user: IUserDocument,
        password: string
    ): Promise<boolean> {
        return bcrypt.compare(password, user.passwordHash);
    }

    static async getUserById(userId: Types.ObjectId, schoolId: Types.ObjectId): Promise<IUserDocument | null> {
        const user = await  User.findOne({ _id: userId, school: schoolId });

        if(!user){
            throw new AppError("User not found in this school", 404);        
        }

        return user;
    }

    static async updateUser(
		userId: Types.ObjectId,
		updateData: Partial<Pick<IUserDocument, "firstName" | "lastName" | "email" | "role" | "phone" | "profilePicture">>
	): Promise<IUserDocument> {
		const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
		if (!user) throw new AppError("User not found", 404);
		return user;
	}

    static async deleteUser(userId: Types.ObjectId): Promise<void> {
		const user = await User.findById(userId);
		if (!user) throw new AppError("User not found", 404);
		await user.deleteOne();
	}

    static async assignRole(userId: Types.ObjectId, role: UserRole): Promise<IUserDocument> {
		const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
		if (!user) throw new AppError("User not found", 404);
		return user;
	}

    static async deactivateUser(userId: Types.ObjectId): Promise<IUserDocument | null> {
        return User.findByIdAndUpdate(userId, { isActive: false }, { new: true });
    }

    static async getAllUsers({
        schoolId,
        role,
        page = 1,
        limit = 20,
        search
    }: {
        schoolId: Types.ObjectId;
        role?: UserRole;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        data: IUserDocument[];
        meta: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }> {
        // enforce sane maximum limit
        limit = Math.min(limit, 100);
        page = Math.max(page, 1);

        const filter: any = { school: schoolId };

        if (role) {
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("-password -resetToken") // remove sensitive fields
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }


    static async getSchoolUserAnalytics (schoolId: Types.ObjectId){
        const stats = await User.aggregate([
            { $match: { school: schoolId } },

            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ["$isActive", true] }, 1, 0]
                        }
                    },
                    inactive: { 
                        $sum: {
                            $cond: [{$ne: ["isActive", false] }, 1, 0]
                        }
                    }
                }
            }
        ])

        const totalUser = stats.reduce((acc, cur) => acc + cur.count, 0 )

        const byRole = stats.reduce<Record<string, any>>((acc, cur) => {
            acc[cur._id] = {
                total: cur.count,
                active: cur.active,
                inactive: cur.inactive
            };
            return acc;
        }, {});

        return {
            totalUser,
            byRole
        };

    }


}
