import { NotFoundError, PermissionDeniedError, FeatureNotAvailableError, AppError } from "../../../shared/errors/domain.errors";
import { REPORTS, REPORT_BY_KEY, ReportContext, ReportDefinition } from "./report-catalogue";
import { MAX_REPORT_ROWS, ReportResult } from "../domain/report.types";
import { toCsv } from "../domain/csv";

/* Who is asking: what they may do (from their role) and what the school's plan includes. */
export interface ReportCaller {
    can(permission: string): boolean;
    hasFeature(feature: string): Promise<boolean>;
}

type Dependencies = Omit<ReportContext, "now">;
interface Options { now?: () => Date }

const tooLarge = (rows: number) => new AppError(
    `This report has ${rows} rows, which is more than can be shown at once. Narrow the dates or choose one account`, 400, true, "REPORT_TOO_LARGE", { rows, max: MAX_REPORT_ROWS });

/*
| THE REPORT ENGINE (brief 9.3): one service runs every report in the catalogue the same way. It checks the permission and the plan
| feature, validates the settings, builds the table, and refuses a table too large to return. Exports use the same run, then write a file.
*/
export class ReportEngine {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    private context(): ReportContext {
        const d = this.d;
        return {
            now: this.now(),
            ledgerReportRepository: d.ledgerReportRepository, statementRepository: d.statementRepository, accountBalancesUseCase: d.accountBalancesUseCase,
            cashBookUseCase: d.cashBookUseCase, expenseReportUseCase: d.expenseReportUseCase, creditorsReportUseCase: d.creditorsReportUseCase,
            ageingReportUseCase: d.ageingReportUseCase, collectionsReportUseCase: d.collectionsReportUseCase,
        };
    }

    /* The reports this person may run, and whether the school's plan includes each. */
    async catalogue(caller: ReportCaller) {
        const out = [];
        for (const r of REPORTS) {
            if (!caller.can(r.permission)) continue;
            const available = r.feature ? await caller.hasFeature(r.feature) : true;
            out.push({ key: r.key, title: r.title, description: r.description, permission: r.permission, feature: r.feature, available, canExport: caller.can("finance.reports.export") });
        }
        return out;
    }

    private async authorize(key: string, caller: ReportCaller): Promise<ReportDefinition> {
        const def = REPORT_BY_KEY.get(key);
        if (!def) throw new NotFoundError("Report");
        if (!caller.can(def.permission)) throw new PermissionDeniedError(def.permission);
        if (def.feature && !(await caller.hasFeature(def.feature))) throw new FeatureNotAvailableError(def.feature);
        return def;
    }

    async run(key: string, rawParams: unknown, caller: ReportCaller): Promise<ReportResult> {
        const def = await this.authorize(key, caller);
        const params = def.params.parse(rawParams ?? {});
        const body = await def.run(params, this.context());
        if (body.rows.length > MAX_REPORT_ROWS) throw tooLarge(body.rows.length);
        return { key: def.key, title: def.title, generatedAt: this.now().toISOString(), params, ...body };
    }

    /* The same report as a downloadable file. Exporting is its own permission. */
    async export(key: string, rawParams: unknown, caller: ReportCaller): Promise<{ filename: string; contentType: string; body: string }> {
        if (!caller.can("finance.reports.export")) throw new PermissionDeniedError("finance.reports.export");
        const r = await this.run(key, rawParams, caller);
        const stamp = String((r.params as any).to ?? (r.params as any).asOf ?? r.generatedAt.slice(0, 10));
        return { filename: `${r.key}-${stamp}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(r) };
    }
}
