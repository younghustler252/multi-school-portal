import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "../domain/auth.enums";

// Emails are always stored and compared trimmed and lowercase
export const emailField    = z.string().trim().toLowerCase().email().max(254);
// Strength rules are applied in the use case (they depend on settings); here only shape
export const passwordField = z.string().min(1, "Password is required").max(PASSWORD_MAX_LENGTH);
export const personaField  = z.enum(["STAFF", "STUDENT", "GUARDIAN"]);
