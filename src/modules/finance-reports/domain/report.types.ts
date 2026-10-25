export type ColumnType = "text" | "money" | "date" | "number";
export interface ReportColumn { key: string; label: string; type: ColumnType }
export type Cell = string | number | boolean | null;
export type ReportRow = Record<string, Cell>;

/* What every report returns: one table the screen can draw and the export can write, plus a summary of the headline numbers.
   Money cells are whole kobo (a number, or a digit string when too large for one). */
export interface ReportBody { columns: ReportColumn[]; rows: ReportRow[]; summary: Record<string, unknown> }
export interface ReportResult extends ReportBody { key: string; title: string; generatedAt: string; params: Record<string, unknown> }

export const MAX_REPORT_ROWS = 50_000;
