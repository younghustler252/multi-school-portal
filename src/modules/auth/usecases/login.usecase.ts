import { IUserRepository }       from "../repositories/user.repository";
import { PasswordService }       from "../../../shared/services/password.service";
import { UserMapper }            from "../mappers/user.mapper";
import { AuthSessionService }    from "../services/auth-session.service";
import { LoginAttemptService }   from "../services/login-attempt.service";
import { MembershipService }     from "../services/membership.service";
import { AuthAuditService }      from "../services/auth-audit.service";
import { authErrors }            from "../domain/auth.errors";
import { ACCOUNT_LOCK_THRESHOLD, ACCOUNT_LOCK_MINUTES } from "../domain/auth.enums";
import { LoginDtoType }          from "../dtos/login.dto";
import { LoginResult, RequestMeta, PersonaType } from "../types/auth.types";
import { randomBytes }           from "crypto";

interface Dependencies {
    userRepository:     IUserRepository;
    passwordService:    PasswordService;
    userMapper:         UserMapper;
    authSessionService: AuthSessionService;
    loginAttemptService: LoginAttemptService;
    membershipService:  MembershipService;
    authAuditService:   AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| LOGIN
| Order matters and is deliberate:
|  1. per (email + IP) limiter, applies to unknown emails too
|  2. look up the user and ALWAYS run one bcrypt comparison (dummy hash when
|     the email is unknown) so timing does not reveal which emails exist
|  3. wrong password -> one generic error, whatever the account state
|  4. only AFTER the password is proven: locked / inactive / unverified messages
|  5. resolve the session from the host:
|       school host   -> tenant Membership (persona selection when several)
|       platform host -> PlatformMember, else the list of the user's schools
|--------------------------------------------------------------------------
*/

export class LoginUseCase {
    private dummyHash: Promise<string> | null = null;

    constructor(private readonly d: Dependencies) {}

    private getDummyHash(): Promise<string> {
        this.dummyHash ??= this.d.passwordService.hash(randomBytes(16).toString("hex"));
        return this.dummyHash;
    }

    async execute(dto: LoginDtoType, meta: RequestMeta, schoolId: string | null): Promise<LoginResult> {
        const d     = this.d;
        const email = dto.email.trim().toLowerCase();

        await d.loginAttemptService.assertNotBlocked(email, meta.ip);

        const user = await d.userRepository.findByEmailWithPassword(email);
        const ok   = await d.passwordService.compare(dto.password, user?.passwordHash ?? await this.getDummyHash());

        if (!user || !ok) {
            await d.loginAttemptService.recordFailure(email, meta.ip);
            if (user) await this.recordAccountFailure(user.id, schoolId, meta);
            else await d.authAuditService.record({
                action: "auth.login_failed", schoolId, ip: meta.ip, userAgent: meta.userAgent,
                metadata: { reason: "unknown_email" },
            });
            throw authErrors.invalidCredentials();
        }

        // ── Password proven ──────────────────────────────────────────────
        if (user.lockedUntil && user.lockedUntil > new Date()) throw authErrors.accountLocked();
        if (!user.isActive)        throw authErrors.accountInactive();
        if (!user.isEmailVerified) throw authErrors.emailNotVerified();

        await d.loginAttemptService.clear(email, meta.ip);

        const resolved = schoolId
            ? await this.resolveSchoolSession(user.id, schoolId, dto.persona)
            : await this.resolvePlatformSession(user.id);

        if ("status" in resolved) {            // selection responses carry no tokens
            if (resolved.status === "DENIED") {
                await d.authAuditService.record({
                    action: "auth.login_failed", userId: user.id, schoolId, ip: meta.ip, userAgent: meta.userAgent,
                    metadata: { reason: "no_access" },
                });
                throw authErrors.invalidCredentials();   // do not reveal school membership
            }
            return resolved;
        }

        if (user.failedLoginCount > 0 || user.lockedUntil) await d.userRepository.resetFailedLogin(user.id);
        await d.userRepository.updateLastLogin(user.id, meta.ip);

        const tokens = await d.authSessionService.issue({
            userId: user.id, schoolId: resolved.schoolId, membershipId: resolved.membershipId,
            mustChangePassword: user.mustChangePassword, ip: meta.ip, userAgent: meta.userAgent,
        });

        await d.authAuditService.record({
            action: "auth.login", userId: user.id, schoolId: resolved.schoolId,
            actorMembershipId: resolved.membershipId, ip: meta.ip, userAgent: meta.userAgent,
            metadata: { persona: resolved.persona, kind: resolved.kind },
        });

        return {
            status: "AUTHENTICATED",
            user:   d.userMapper.toResponse(user),
            session: resolved,
            tokens,
        };
    }

    // ── Failure bookkeeping ──────────────────────────────────────────────
    private async recordAccountFailure(userId: string, schoolId: string | null, meta: RequestMeta): Promise<void> {
        const count = await this.d.userRepository.incrementFailedLogin(userId);
        const locked = count >= ACCOUNT_LOCK_THRESHOLD;
        if (locked) {
            await this.d.userRepository.lockAccount(userId, new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60_000));
        }
        await this.d.authAuditService.record({
            action: locked ? "auth.account_locked" : "auth.login_failed",
            userId, schoolId, ip: meta.ip, userAgent: meta.userAgent,
            metadata: { reason: "bad_password", failedCount: count },
        });
    }

    // ── Session resolution ───────────────────────────────────────────────
    private async resolveSchoolSession(userId: string, schoolId: string, requested?: PersonaType) {
        const memberships = await this.d.membershipService.listActive(userId);
        const pool = requested ? memberships.filter(m => m.persona === requested) : memberships;

        if (pool.length === 0) return { status: "DENIED" as const };
        if (pool.length > 1) {
            return {
                status:   "PERSONA_SELECTION_REQUIRED" as const,
                personas: pool.map(m => m.persona),
            };
        }
        return { kind: "school" as const, schoolId, membershipId: pool[0].id, persona: pool[0].persona };
    }

    private async resolvePlatformSession(userId: string) {
        const member = await this.d.membershipService.getActivePlatformMember(userId);
        if (member) return { kind: "platform" as const, schoolId: null, membershipId: member.id, persona: null };

        const schools = await this.d.membershipService.listUserSchools(userId);
        if (schools.length === 0) return { status: "DENIED" as const };
        return { status: "SCHOOL_SELECTION_REQUIRED" as const, schools };
    }
}
