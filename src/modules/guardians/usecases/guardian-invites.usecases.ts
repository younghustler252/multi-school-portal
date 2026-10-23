import { SendInviteUseCase } from "../../auth/usecases/send-invite.usecase";
import { MembershipService } from "../../auth/services/membership.service";
import { IGuardianRepository } from "../repositories/guardian.repository";
import { guardianErrors } from "../domain/guardian.errors";
import { GuardianActor, InviteStatus } from "../domain/guardian.types";
import { BulkInviteGuardiansDtoType } from "../dtos/guardian.dto";

interface Dependencies { guardianRepository: IGuardianRepository; sendInviteUseCase: SendInviteUseCase; membershipService: MembershipService }

/*
|--------------------------------------------------------------------------
| INVITE GUARDIAN (portal access)
| Uses Auth's invitation flow, so the invite is saved (hashed, expiring, one use), the email comes from the
| templates, and accepting it links the new login to THIS guardian record. This module has no token or email
| code of its own. A guardian who already has access is refused; a second invite replaces an unused earlier one.
|--------------------------------------------------------------------------
*/
export class InviteGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, actor: GuardianActor) {
        const d = this.d;
        const guardian = await d.guardianRepository.findById(id);
        if (!guardian) throw guardianErrors.notFound();
        if (guardian.userId || await d.membershipService.findByEntity("GUARDIAN", id)) throw guardianErrors.alreadyHasAccess();

        return d.sendInviteUseCase.execute(
            { email: guardian.email, persona: "GUARDIAN", personaEntityId: id, firstName: guardian.firstName },
            schoolId,
            { userId: actor.userId, membershipId: actor.membershipId, isAdmin: actor.isAdmin, can: (k: string) => actor.access.can(k) },
            { ip: actor.ip, userAgent: actor.userAgent },
        );
    }
}

export interface BulkInviteResultItem { guardianId: string; status: "sent" | "skipped" | "failed"; code?: string }
export interface BulkInviteGuardiansResult { sent: number; skipped: number; failed: number; results: BulkInviteResultItem[] }

/*
| BULK INVITE. One result per guardian (sent, skipped because they already have access, or failed with a code).
| Safe to run again: a repeat replaces the unused earlier invite instead of stacking a second one.
*/
export class BulkInviteGuardiansUseCase {
    constructor(private readonly d: { inviteGuardianUseCase: InviteGuardianUseCase }) {}

    async execute(schoolId: string, dto: BulkInviteGuardiansDtoType, actor: GuardianActor): Promise<BulkInviteGuardiansResult> {
        const results: BulkInviteResultItem[] = [];
        for (const guardianId of [...new Set(dto.guardianIds)]) {
            try {
                await this.d.inviteGuardianUseCase.execute(schoolId, guardianId, actor);
                results.push({ guardianId, status: "sent" });
            } catch (err: any) {
                const code = err?.code ?? "INVITE_FAILED";
                results.push({ guardianId, status: code === "GUARDIAN_ALREADY_HAS_ACCESS" ? "skipped" : "failed", code });
            }
        }
        return {
            sent: results.filter(r => r.status === "sent").length, skipped: results.filter(r => r.status === "skipped").length,
            failed: results.filter(r => r.status === "failed").length, results,
        };
    }
}

/** Turns an invite attempt into a status the API can report next to a saved guardian. */
export async function tryInvite(run: () => Promise<unknown>): Promise<InviteStatus> {
    try { await run(); return { status: "sent" }; }
    catch (err: any) {
        if (err?.code === "GUARDIAN_ALREADY_HAS_ACCESS") return { status: "not_needed", code: err.code };
        return { status: "failed", code: err?.code ?? "INVITE_FAILED" };
    }
}
