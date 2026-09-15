import bcrypt from "bcrypt";

/*
|--------------------------------------------------------------------------
| PASSWORD SERVICE
| Handles password hashing, comparison and temporary password generation
|--------------------------------------------------------------------------
*/

const SALT_ROUNDS = 12;

export class PasswordService {

    // ── Generate temporary password ───────────────────────────────────────
    generateTemp(length = 10): string {
        const uppercase = "ABCDEFGHJKMNPQRSTUVWXYZ";
        const lowercase = "abcdefghjkmnpqrstuvwxyz";
        const numbers   = "23456789";
        const special   = "!@#$%^&*";

        const all = uppercase + lowercase + numbers + special;

        // Guarantee all required character types
        const chars = [
            uppercase[Math.floor(Math.random() * uppercase.length)],
            lowercase[Math.floor(Math.random() * lowercase.length)],
            numbers[Math.floor(Math.random() * numbers.length)],
            special[Math.floor(Math.random() * special.length)],
        ];

        // Fill remaining characters
        for (let i = chars.length; i < length; i++) {
            chars.push(
                all[Math.floor(Math.random() * all.length)],
            );
        }

        // Shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        return chars.join("");
    }

    // ── Hash password ─────────────────────────────────────────────────────
    async hash(plainText: string): Promise<string> {
        return bcrypt.hash(plainText, SALT_ROUNDS);
    }

    // ── Compare password ──────────────────────────────────────────────────
    async compare(plainText: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainText, hash);
    }

    // ── Validate password strength ─────────────────────────────────────────
    validate(password: string): { valid: boolean; message?: string } {
        if (password.length < 8) {
            return {
                valid: false,
                message: "Password must be at least 8 characters",
            };
        }

        if (!/[A-Z]/.test(password)) {
            return {
                valid: false,
                message: "Password must contain at least one uppercase letter",
            };
        }

        if (!/[a-z]/.test(password)) {
            return {
                valid: false,
                message: "Password must contain at least one lowercase letter",
            };
        }

        if (!/[0-9]/.test(password)) {
            return {
                valid: false,
                message: "Password must contain at least one number",
            };
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return {
                valid: false,
                message: "Password must contain at least one special character",
            };
        }

        return { valid: true };
    }
}
