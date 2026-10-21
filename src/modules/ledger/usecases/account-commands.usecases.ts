import { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { ILedgerReportRepository } from "../repositories/ledger-report.repository";
import { LedgerAccountMapper } from "../mappers/ledger-account.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { ledgerErrors } from "../domain/ledger.errors";
import { LedgerAccountEntity } from "../domain/ledger.entity";
import { CODE_PREFIX, nextAccountCode } from "../domain/ledger.policy";
import { CreateAccountDtoType, UpdateAccountDtoType } from "../dtos/ledger.dto";

interface Dependencies {
    ledgerAccountRepository: ILedgerAccountRepository; ledgerReportRepository: ILedgerReportRepository;
    ledgerAccountMapper: LedgerAccountMapper; auditService: AuditService;
}

const MAX_DEPTH = 20;
const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

async function loadAccount(repo: ILedgerAccountRepository, id: string): Promise<LedgerAccountEntity> {
    const a = await repo.findById(id);
    if (!a) throw ledgerErrors.accountNotFound(id);
    return a;
}

// The parent must exist, be active and be the same type (income sits under income, and so on)
async function checkParent(repo: ILedgerAccountRepository, parentId: string, type: string, selfId?: string): Promise<void> {
    const parent = await repo.findById(parentId);
    if (!parent || !parent.isActive) throw ledgerErrors.accountInvalid("The parent account does not exist or is not active");
    if (parent.type !== type) throw ledgerErrors.accountInvalid("An account can only sit under an account of the same type");
    if (selfId) {                                          // moving an account under its own descendant would make a loop
        let cursor: LedgerAccountEntity | null = parent;
        for (let depth = 0; cursor && depth < MAX_DEPTH; depth++) {
            if (cursor.id === selfId) throw ledgerErrors.accountInvalid("An account cannot sit under itself or under one of its own sub-accounts");
            cursor = cursor.parentId ? await repo.findById(cursor.parentId) : null;
        }
    }
}

/*
| ADD AN ACCOUNT. Four-digit code whose first digit matches the type (made automatically when omitted), a type that
| never changes, and a kind: general, or a money account (cash, bank, petty cash) that payments can land in.
| System accounts are created by the system only.
*/
export class CreateAccountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateAccountDtoType) {
        const repo = this.d.ledgerAccountRepository;
        const prefix = CODE_PREFIX[dto.type];

        let code = dto.code;
        if (code) {
            if (!code.startsWith(prefix)) throw ledgerErrors.accountCodeInvalid(`${dto.type.toLowerCase()} accounts use codes starting with ${prefix}`);
        } else {
            code = nextAccountCode(dto.type, await repo.codesInRange(prefix)) ?? undefined;
            if (!code) throw ledgerErrors.accountCodeInvalid("No automatic codes are left in this range. Enter a code yourself");
        }
        if (await repo.codeExists(code)) throw ledgerErrors.accountCodeTaken(code);
        if (dto.parentId) await checkParent(repo, dto.parentId, dto.type);

        let account: LedgerAccountEntity;
        try {
            account = await repo.create({
                code, name: dto.name, type: dto.type, subtype: dto.kind, isMoneyAccount: dto.kind !== "GENERAL",
                parentId: dto.parentId ?? null, description: dto.description ?? null,
                bankName: dto.bankName ?? null, accountName: dto.accountName ?? null, accountNumberLast4: dto.accountNumberLast4 ?? null,
                isLocked: false, createdById: actorUserId, updatedById: actorUserId,
            });
        } catch (e) {
            if (isUniqueViolation(e)) throw ledgerErrors.accountCodeTaken(code);       // two people added the same code at once
            throw e;
        }
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.account.created", entity: "LedgerAccount", entityId: account.id,
            newValue: { code: account.code, name: account.name, type: account.type, subtype: account.subtype, parentId: account.parentId },
        });
        return this.d.ledgerAccountMapper.toResponse(account);
    }
}

/* EDIT AN ACCOUNT: name, description, sort order, nesting, bank details. System accounts may only be renamed. */
export class UpdateAccountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateAccountDtoType) {
        const repo = this.d.ledgerAccountRepository;
        const account = await loadAccount(repo, id);

        if (account.isLocked && dto.parentId !== undefined) throw ledgerErrors.accountLockedFor(account.name, "moved under another account");
        if ((dto.bankName || dto.accountName || dto.accountNumberLast4) && account.subtype !== "BANK") {
            throw ledgerErrors.accountInvalid("Bank details belong to bank accounts");
        }
        if (dto.parentId) await checkParent(repo, dto.parentId, account.type, account.id);

        const changes: Record<string, unknown> = {};
        for (const key of ["name", "description", "parentId", "bankName", "accountName", "accountNumberLast4", "sortOrder"] as const) {
            if (dto[key] !== undefined && dto[key] !== account[key]) changes[key] = dto[key];
        }
        if (Object.keys(changes).length === 0) return this.d.ledgerAccountMapper.toResponse(account);

        const before = Object.fromEntries(Object.keys(changes).map(k => [k, (account as unknown as Record<string, unknown>)[k]]));
        const updated = await repo.update(id, { ...changes, updatedById: actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.account.updated", entity: "LedgerAccount", entityId: id,
            oldValue: before, newValue: changes,
        });
        return this.d.ledgerAccountMapper.toResponse(updated);
    }
}

/*
| DEACTIVATE / REACTIVATE. A deactivated account disappears from pickers but keeps its history, and reports still show it.
| Refused for system accounts, for an account with active sub-accounts, and for a money account that still holds money.
*/
export class SetAccountActiveUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, active: boolean) {
        const repo = this.d.ledgerAccountRepository;
        const account = await loadAccount(repo, id);

        if (active) {
            if (account.isActive) throw ledgerErrors.accountAlreadyActive(account.name);
            if (account.parentId && !(await repo.findById(account.parentId))?.isActive) {
                throw ledgerErrors.accountInvalid("Reactivate the parent account first");
            }
        } else {
            if (account.isLocked) throw ledgerErrors.accountLockedFor(account.name, "deactivated");
            if (!account.isActive) throw ledgerErrors.accountAlreadyInactive(account.name);
            const children = await repo.countChildren(id, true);
            if (children > 0) throw ledgerErrors.accountHasChildren(account.name, children);
            if (account.isMoneyAccount) {
                const t = await this.d.ledgerReportRepository.totalsBefore(id, "9999-12-31");
                if (t.debit !== t.credit) throw ledgerErrors.accountHasBalance(account.name, (t.debit - t.credit).toString());
            }
        }

        const updated = await repo.update(id, { isActive: active, updatedById: actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: active ? "finance.account.reactivated" : "finance.account.deactivated",
            entity: "LedgerAccount", entityId: id, oldValue: { isActive: account.isActive }, newValue: { isActive: active },
        });
        return this.d.ledgerAccountMapper.toResponse(updated);
    }
}

/* DELETE: only an account that was never used (no postings, no sub-accounts) and is not a system account. */
export class DeleteAccountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const repo = this.d.ledgerAccountRepository;
        const account = await loadAccount(repo, id);

        if (account.isLocked) throw ledgerErrors.accountLockedFor(account.name, "deleted");
        const lines = await repo.countLines(id);
        if (lines > 0) throw ledgerErrors.accountHasPostings(account.name, lines);
        const children = await repo.countChildren(id, false);
        if (children > 0) throw ledgerErrors.accountHasChildren(account.name, children);

        await repo.delete(id);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.account.deleted", entity: "LedgerAccount", entityId: id,
            oldValue: { code: account.code, name: account.name, type: account.type },
        });
        return { id };
    }
}
