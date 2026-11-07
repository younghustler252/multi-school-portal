import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import type { LoginResult, Persona } from "@/lib/auth/session-types";
import {
	LoginDto,
	RegisterResponseData,
	VerifyEmailResponseData,
	RegisterDto,
	VerifyEmailDto,
	ResendOtpDto,
	ForgotPasswordDto,
	ResetPasswordDto,
	AcceptInviteDto,
} from "../types/auth.types";

/*
| Auth endpoints (envelope style: never throws). The session itself lives in HttpOnly cookies; no token ever reaches
| JavaScript. The login-style endpoints answer with a LoginResult union, so callers must check `status`.
*/
export const authApi = {

	// ==================================
	// LOGIN / REGISTER / REFRESH
	// ==================================

	login: (data: LoginDto): Promise<ApiResponse<LoginResult>> =>
		API.post("/auth/login", data),

	register: (data: RegisterDto): Promise<ApiResponse<RegisterResponseData>> =>
		API.post("/auth/register", data),

	// Called by the API client's refresh coordinator directly; exposed for completeness.
	refresh: (): Promise<ApiResponse<LoginResult>> =>
		API.post("/auth/refresh"),

	logout: (): Promise<ApiResponse<null>> =>
		API.post("/auth/logout"),

	// School host only. Moves the session to another persona the user holds in this school.
	switchPersona: (persona: Persona): Promise<ApiResponse<LoginResult>> =>
		API.post("/auth/switch-persona", { persona }),

	// The API's DTO field is `ticket`.
	exchangeImpersonationToken: (ticket: string): Promise<ApiResponse<LoginResult>> =>
		API.post("/auth/exchange-impersonation-token", { ticket }),

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

	acceptInvite: (data: AcceptInviteDto): Promise<ApiResponse<LoginResult>> =>
		API.post("/auth/invite/accept", data),

};
