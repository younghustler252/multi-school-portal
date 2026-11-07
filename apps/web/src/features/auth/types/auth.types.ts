import type { LoginResult, Persona } from "@/lib/auth/session-types";

/*
|--------------------------------------------------------------------------
| USER RESPONSE
| Mirrors backend: UserEntity.toResponse() — field for field
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| LOGIN + REFRESH
| Mirrors backend: LoginDto, RefreshTokenDto
|--------------------------------------------------------------------------
*/

export interface LoginDto {
	email: string;
	password: string;
	/** Second step of a persona selection: the chosen persona, with the same credentials. */
	persona?: Persona;
}

export interface RefreshTokenDto {
	refreshToken?: string; // optional — usually comes from httpOnly cookie
}
export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export type LoginResponseData = LoginResult;
export interface RegisterResponseData {
	message: string;
	subdomain: string;
}
export interface VerifyEmailResponseData {
	message: string;
}

/*
|--------------------------------------------------------------------------
| OTP — EMAIL VERIFICATION
| Mirrors backend: VerifyEmailDto, ResendOtpDto
|--------------------------------------------------------------------------
*/

export interface VerifyEmailDto {
	email: string;
	otp: string; // 6 digits
}

export interface ResendOtpDto {
	email: string;
	type?: "email_verification" | "password_reset"; // API default: email_verification
}

/*
|--------------------------------------------------------------------------
| PASSWORD FLOWS
| Mirrors backend: ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto
|--------------------------------------------------------------------------
*/

export interface ForgotPasswordDto {
	email: string;
}

export interface ResetPasswordDto {
	email: string;
	otp: string;
	newPassword: string;
	confirmPassword: string;
}

/*
|--------------------------------------------------------------------------
| REGISTER (SCHOOL SIGNUP)
| Mirrors backend: RegisterDto exactly
|--------------------------------------------------------------------------
*/

export type SchoolCategory = "primary" | "secondary" | "primary_secondary";
export type SchoolOwnership = "private" | "public" | "mission" | "international";

export interface RegisterDto {
	// School info
	schoolName: string;
	subdomain: string;
	schoolEmail: string;
	schoolPhone?: string;
	schoolCategory: SchoolCategory;
	schoolOwnership: SchoolOwnership;
	state?: string;
	city?: string;

	// Admin info
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	phone?: string;
}


export interface AcceptInviteDto {
	token: string;
	firstName: string;
	lastName: string;
	password: string;
	confirmPassword: string;
	phone?: string;
}