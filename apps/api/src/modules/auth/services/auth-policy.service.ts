import { PrismaClient } from "../../../generated/public/client";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { PasswordService } from "../../../shared/services/password.service";
import { DEFAULT_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "../domain/auth.enums";
import { authErrors } from "../domain/auth.errors";

const SETTING_KEY = "security.password_min_length";

function toInt(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
    if (typeof raw === "string") {
        try { return toInt(JSON.parse(raw)); } catch { const n = Number(raw); return Number.isFinite(n) ? Math.trunc(n) : null; }
    }
    return null;
}

/*
|--------------------------------------------------------------------------
| AUTH POLICY
| Password minimum length = school override (tenant SchoolSettingValue) else
| platform default (SettingDefinition.defaultValue) else 8; clamped 8 to 32.
| Composition rules stay in PasswordService.validate.
| Pass inTenant=true only when a tenant context is active.
|--------------------------------------------------------------------------
*/

export class AuthPolicyService {
    private readonly prisma: PrismaClient;
    private readonly passwords: PasswordService;

    constructor({ prismaClient, passwordService }: { prismaClient: PrismaClient; passwordService: PasswordService }) {
        this.prisma    = prismaClient;
        this.passwords = passwordService;
    }

    async passwordMinLength(inTenant: boolean): Promise<number> {
        let value: number | null = null;

        if (inTenant) {
            const row = await getTenantClient().schoolSettingValue.findUnique({ where: { key: SETTING_KEY } });
            value = row ? toInt(row.value) : null;
        }
        if (value === null) {
            const def = await this.prisma.settingDefinition.findUnique({ where: { key: SETTING_KEY } });
            value = def ? toInt(def.defaultValue) : null;
        }
        return Math.min(32, Math.max(DEFAULT_PASSWORD_MIN_LENGTH, value ?? DEFAULT_PASSWORD_MIN_LENGTH));
    }

    async assertPasswordAllowed(password: string, inTenant: boolean): Promise<void> {
        if (password.length > PASSWORD_MAX_LENGTH) throw authErrors.weakPassword("Password is too long");

        const minLength = await this.passwordMinLength(inTenant);
        if (password.length < minLength) {
            throw authErrors.weakPassword(`Password must be at least ${minLength} characters`);
        }
        const check = this.passwords.validate(password);
        if (!check.valid) throw authErrors.weakPassword(check.message ?? "Password is too weak");
    }
}
