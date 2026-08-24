import { Role } from "@/types/roles";

export interface UserProfileResponseData {
	id: string;
	email: string;
	role: Role;
	firstName: string;
	lastName: string;
	phone: string | null;
	photoUrl: string | null;
	schoolId: string | null;
	isEmailVerified: boolean;
	mustChangePassword: boolean; 
	lastLoginAt: string | null;
	createdAt: string;
}

export interface UpdateProfileDto {
	firstName?: string;
	lastName?: string;
	phone?: string;
}

export interface ChangePasswordDto {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export interface AvatarUploadResponseData {
	photoUrl: string;
}