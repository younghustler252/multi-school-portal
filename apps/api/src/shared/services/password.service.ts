import bcrypt  from "bcrypt";
import crypto  from "crypto";

/*
|--------------------------------------------------------------------------
| PASSWORD SERVICE
| Hashing, comparison, temporary passwords and baseline strength rules.
| Change from the previous version: generateTemp now uses crypto.randomInt
| (Math.random is not cryptographically secure and these passwords are credentials).
| Minimum LENGTH is enforced by the auth policy service from settings;
| validate() keeps the composition rules.
|--------------------------------------------------------------------------
*/

const SALT_ROUNDS = 12;

const pick = (chars: string): string => chars[crypto.randomInt(0, chars.length)];

export class PasswordService {

    generateTemp(length = 10): string {
        const uppercase = "ABCDEFGHJKMNPQRSTUVWXYZ";
        const lowercase = "abcdefghjkmnpqrstuvwxyz";
        const numbers   = "23456789";
        const special   = "!@#$%^&*";
        const all       = uppercase + lowercase + numbers + special;

        const chars = [pick(uppercase), pick(lowercase), pick(numbers), pick(special)];
        for (let i = chars.length; i < length; i++) chars.push(pick(all));

        // Fisher-Yates shuffle with a secure source
        for (let i = chars.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join("");
    }

    async hash(plainText: string): Promise<string> {
        return bcrypt.hash(plainText, SALT_ROUNDS);
    }

    async compare(plainText: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainText, hash);
    }

    validate(password: string): { valid: boolean; message?: string } {
        if (password.length < 8)            return { valid: false, message: "Password must be at least 8 characters" };
        if (!/[A-Z]/.test(password))        return { valid: false, message: "Password must contain at least one uppercase letter" };
        if (!/[a-z]/.test(password))        return { valid: false, message: "Password must contain at least one lowercase letter" };
        if (!/[0-9]/.test(password))        return { valid: false, message: "Password must contain at least one number" };
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return { valid: false, message: "Password must contain at least one special character" };
        }
        return { valid: true };
    }
}
