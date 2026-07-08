import bcrypt from "bcrypt";

/*
|--------------------------------------------------------------------------
| PASSWORD SERVICE
| Handles password hashing and comparison using bcrypt
|--------------------------------------------------------------------------
*/

const SALT_ROUNDS = 12;

export class PasswordService {

    // ── Hash password ─────────────────────────────────────────────────────
    async hash(plainText: string): Promise<string> {
        return bcrypt.hash(plainText, SALT_ROUNDS);
    }

    // ── Compare password ──────────────────────────────────────────────────
    async compare(plainText: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainText, hash);
    }

    // ── Validate password strength ────────────────────────────────────────
    validate(password: string): { valid: boolean; message?: string } {
        if (password.length < 8) {
            return {
                valid:   false,
                message: "Password must be at least 8 characters",
            };
        }

        if (!/[A-Z]/.test(password)) {
            return {
                valid:   false,
                message: "Password must contain at least one uppercase letter",
            };
        }

        if (!/[a-z]/.test(password)) {
            return {
                valid:   false,
                message: "Password must contain at least one lowercase letter",
            };
        }

        if (!/[0-9]/.test(password)) {
            return {
                valid:   false,
                message: "Password must contain at least one number",
            };
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return {
                valid:   false,
                message: "Password must contain at least one special character",
            };
        }

        return { valid: true };
    }
}