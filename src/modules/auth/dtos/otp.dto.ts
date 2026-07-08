import { z } from "zod";

/*
|--------------------------------------------------------------------------
| OTP DTOs
| Email verification + resend OTP
|--------------------------------------------------------------------------
*/

export const VerifyEmailDto = z.object({
    email: z.string().email(),
    otp:   z.string().length(6, "OTP must be 6 digits"),
});

export const ResendOtpDto = z.object({
    email: z.string().email(),
});

export type VerifyEmailDtoType = z.infer<typeof VerifyEmailDto>;
export type ResendOtpDtoType   = z.infer<typeof ResendOtpDto>;