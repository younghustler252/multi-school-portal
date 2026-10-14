import { z } from "zod";
import { emailField, personaField } from "./common";

export const LoginDto = z.object({
    email:    emailField,
    password: z.string().min(1, "Password is required").max(128),
    // Only needed when the account holds several profiles in this school
    persona:  personaField.optional(),
});

export const RefreshTokenDto = z.object({
    refreshToken: z.string().optional(), // may come from the cookie instead
});

export const SwitchPersonaDto = z.object({
    persona: personaField,
});

export const ImpersonationExchangeDto = z.object({
    ticket: z.string().min(16).max(200),
});

export type LoginDtoType                  = z.infer<typeof LoginDto>;
export type RefreshTokenDtoType           = z.infer<typeof RefreshTokenDto>;
export type SwitchPersonaDtoType          = z.infer<typeof SwitchPersonaDto>;
export type ImpersonationExchangeDtoType  = z.infer<typeof ImpersonationExchangeDto>;
