import { z } from "zod";

/*
|--------------------------------------------------------------------------
| LOGIN + REFRESH TOKEN DTOs
|--------------------------------------------------------------------------
*/

export const LoginDto = z.object({
    email:    z.string().email(),
    password: z.string().min(1, "Password is required"),
});

export const RefreshTokenDto = z.object({
    refreshToken: z.string().optional(), // optional — may come from cookie
});

export type LoginDtoType        = z.infer<typeof LoginDto>;
export type RefreshTokenDtoType = z.infer<typeof RefreshTokenDto>;