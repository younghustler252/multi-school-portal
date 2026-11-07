import type { MyPermissions } from "@schoolos/contracts";
import { API, apiCall } from "@/lib/api/api-client";
import type { Profile } from "@/lib/auth/session-types";
import type { ApiResponse } from "@/types/api-response";
import {
	UserProfileResponseData,
	UpdateProfileDto,
	ChangePasswordDto,
	AvatarUploadResponseData,
} from "../types/user.types";

export const userApi = {

	// Session bootstrap: both throw ApiError. The store loads them together and never one without the other.
	getMe: (): Promise<Profile> => apiCall<Profile>({ method: "GET", url: "/users/me" }),

	getMyPermissions: (): Promise<MyPermissions> => apiCall<MyPermissions>({ method: "GET", url: "/users/me/permissions" }),

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