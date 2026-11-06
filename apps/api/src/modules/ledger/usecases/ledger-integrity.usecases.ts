import type { ISchoolRepository } from "../../school/repositories/school.repository";
import { ILedgerIntegrityRepository } from "../repositories/ledger-integrity.repository";
import { IntegrityFinding, IntegrityReport, buildReport, systemAccountFindings } from "../domain/ledger-integrity";
import { FINANCE_TIMEZONE } from "../domain/ledger.constants";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";

export const INTEGRITY_ACTOR_ID = "SYSTEM_LEDGER_INTEGRITY";

/* Runs every check against the school whose tenant context is open, and returns what it found. Read-only. */
export class RunLedgerIntegrityCheckUseCase {
    constructor(private readonly d: { ledgerIntegrityRepository: ILedgerIntegrityRepository }, private readonly now: () => Date = () => new Date()) {}

    async execute(): Promise<IntegrityReport> {
        const r = this.d.ledgerIntegrityRepository;
        const findings: IntegrityFinding[] = [
            ...await r.unbalancedJournals(),
            ...await r.trialBalance(),
            ...await r.reversalProblems(),
            ...await r.periodProblems(FINANCE_TIMEZONE),
            ...await r.duplicateOpeningBalances(),
            ...await r.linesOnDeletedAccounts(),
            ...await r.feesControls(),
            ...await r.expensesControls(),
            ...await r.payrollControls(),
            ...systemAccountFindings(await r.systemAccounts()),
        ];
        return buildReport(findings, this.now());
    }
}

export interface SchoolRef { id: string; name: string; schemaName: string }
export interface IntegrityRunSummary {
    schools: number; clean: number;
    failing: Array<{ schoolId: string; name: string; byCheck: IntegrityReport["byCheck"] }>;
    crashed: Array<{ schoolId: string; name: string; error: string }>;
}

/*
| NIGHTLY RUN over every school that has a database schema. One school failing, or crashing, never stops the others.
| A school with findings gets an audit entry (system actor) so the platform team can see it, and is returned to the caller
| (the worker reports it to Sentry). A clean school writes nothing.
*/
export class RunLedgerIntegrityForAllSchoolsUseCase {
    constructor(
        private readonly d: { runLedgerIntegrityCheckUseCase: RunLedgerIntegrityCheckUseCase; auditService: AuditService; schoolRepository?: ISchoolRepository },
        private readonly listSchools: () => Promise<SchoolRef[]> = () => schoolsWithWorkspace(this.d.schoolRepository!),
    ) {}

    async execute(): Promise<IntegrityRunSummary> {
        const schools = await this.listSchools();
        const summary: IntegrityRunSummary = { schools: schools.length, clean: 0, failing: [], crashed: [] };

        for (const school of schools) {
            try {
                const report = await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, () => this.d.runLedgerIntegrityCheckUseCase.execute());
                if (report.ok) { summary.clean++; continue; }

                summary.failing.push({ schoolId: school.id, name: school.name, byCheck: report.byCheck });
                await this.d.auditService.log({
                    userId: INTEGRITY_ACTOR_ID, schoolId: school.id, actorType: ActorType.SYSTEM, action: "finance.integrity.failed",
                    entity: "Finance", entityId: school.id, newValue: { byCheck: report.byCheck, firstFindings: report.findings.slice(0, 10) },
                });
            } catch (err) {
                summary.crashed.push({ schoolId: school.id, name: school.name, error: err instanceof Error ? err.message : String(err) });
            }
        }
        return summary;
    }
}

// Schools whose own schema is built and that are switched on
async function schoolsWithWorkspace(repo: ISchoolRepository): Promise<SchoolRef[]> {
    return (await repo.findMany({ isActive: true, schemaProvisionedAt: { not: null } })).filter(s => !!s.schemaName).map(s => ({ id: s.id, name: s.name, schemaName: s.schemaName! }));
}
