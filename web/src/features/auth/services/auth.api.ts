import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	LoginDto,
	LoginResponseData,
	RegisterResponseData,
	RefreshResponseData,
	VerifyEmailResponseData,
	RegisterDto,
	VerifyEmailDto,
	ResendOtpDto,
	ForgotPasswordDto,
	ResetPasswordDto,
} from "../types/auth.types";

export const authApi = {

	// ==================================
	// LOGIN / REGISTER / REFRESH
	// ==================================

	login: (data: LoginDto): Promise<ApiResponse<LoginResponseData>> =>
		API.post("/auth/login", data),

	register: (data: RegisterDto): Promise<ApiResponse<RegisterResponseData>> =>
		API.post("/auth/register", data),

	refresh: (): Promise<ApiResponse<RefreshResponseData>> =>
		API.post("/auth/refresh"),

	logout: (): Promise<ApiResponse<null>> =>
		API.post("/auth/logout"),

	// ==================================
	// EMAIL VERIFICATION
	// ==================================

	verifyEmail: (data: VerifyEmailDto): Promise<ApiResponse<VerifyEmailResponseData>> =>
		API.post("/auth/verify-email", data),

	resendOtp: (data: ResendOtpDto): Promise<ApiResponse<null>> =>
		API.post("/auth/resend-otp", data),

	// ==================================
	// PASSWORD FLOWS
	// ==================================

	forgotPassword: (data: ForgotPasswordDto): Promise<ApiResponse<null>> =>
		API.post("/auth/forgot-password", data),

	resetPassword: (data: ResetPasswordDto): Promise<ApiResponse<null>> =>
		API.post("/auth/reset-password", data),

};