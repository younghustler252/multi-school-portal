export type UserProfileResponseData = import("@/lib/auth/session-types").Profile;

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