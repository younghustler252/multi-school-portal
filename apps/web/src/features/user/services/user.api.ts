import { API } from "@/lib/api/api-client";
import type { ApiResponse } from "@/types/api-response";
import {
	UserProfileResponseData,
	UpdateProfileDto,
	ChangePasswordDto,
	AvatarUploadResponseData,
} from "../types/user.types";

export const userApi = {

	getProfile: (): Promise<ApiResponse<UserProfileResponseData>> =>
		API.get("/users/me"),

	updateProfile: (
		data: UpdateProfileDto
	): Promise<ApiResponse<UserProfileResponseData>> =>
		API.put(
			"/users/me",
			data
		),

	changePassword: (
		data: ChangePasswordDto
	): Promise<ApiResponse<null>> =>
		API.put(
			"/users/me/password",
			data
		),

	uploadAvatar: (
		file: File
	): Promise<ApiResponse<AvatarUploadResponseData>> => {
		const formData = new FormData();

		formData.append(
			"avatar",
			file
		);

		return API.post(
			"/users/me/avatar",
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
				},
			}
		);
	},

};