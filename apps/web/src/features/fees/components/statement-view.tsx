"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKobo, isPositiveKobo, toBigInt } from "@/lib/money";
import { useFamilyStatement } from "../hooks/use-family-fees";
import { formatDay, STATEMENT_KIND_TEXT } from "../lib/finance-labels";
import { statementRange } from "../lib/family-fees";

/*
| A child's statement (GET /fees/my/statement/:studentId). Charges raise the balance, payments and adjustments lower it,
| and a running balance below zero is credit (shown as "credit"). Dates are the school's days; nothing is converted.
*/
export function StatementView({ studentId }: { studentId: string }) {
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const range = statementRange(from, to);
	const { data: statement, isLoading, isError } = useFamilyStatement(range ? studentId : "", range ?? {});

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<label className="text-sm"><span className="mb-1 block text-muted-foreground">From</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
				<label className="text-sm"><span className="mb-1 block text-muted-foreground">To</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
			</div>

			{!range && <p className="text-sm text-destructive">The start date must not be after the end date.</p>}
			{range && isLoading && <Skeleton className="h-40 rounded-xl" />}
			{range && isError && <p className="text-sm text-destructive">Couldn&apos;t load the statement. Try again in a moment.</p>}

			{statement && (
				<>
					<dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
						<Tile label="Charged" value={formatKobo(statement.totals.chargedKobo)} />
						<Tile label="Paid" value={formatKobo(statement.totals.paidKobo)} />
						<Tile label="Adjusted" value={formatKobo(statement.totals.adjustedKobo)} />
						<Tile label={isPositiveKobo(statement.creditKobo) ? "Credit" : "Owed now"} value={formatKobo(isPositiveKobo(statement.creditKobo) ? statement.creditKobo : statement.owedKobo)} />
					</dl>

					<div className="overflow-x-auto rounded-xl border border-border">
						<table className="w-full text-left text-sm">
							<thead className="bg-muted/50 text-xs text-muted-foreground">
								<tr><th className="px-4 py-2 font-normal">Date</th><th className="px-4 py-2 font-normal">Details</th><th className="px-4 py-2 text-right font-normal">Amount</th><th className="px-4 py-2 text-right font-normal">Balance</th></tr>
							</thead>
							<tbody className="divide-y divide-border">
								<tr className="text-muted-foreground"><td className="px-4 py-2" colSpan={3}>Opening balance{statement.from ? ` (${formatDay(statement.from)})` : ""}</td><td className="px-4 py-2 text-right">{balanceText(statement.openingKobo)}</td></tr>
								{statement.entries.length === 0 && <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>Nothing in this period.</td></tr>}
								{statement.entries.map((e, i) => (
									<tr key={`${e.date}-${e.kind}-${e.reference ?? i}-${i}`}>
										<td className="whitespace-nowrap px-4 py-2">{formatDay(e.date)}</td>
										<td className="px-4 py-2">{STATEMENT_KIND_TEXT[e.kind]}<div className="text-xs text-muted-foreground">{e.description}{e.reference ? ` · ${e.reference}` : ""}</div></td>
										<td className={`px-4 py-2 text-right ${toBigInt(e.amountKobo) < 0n ? "text-success" : ""}`}>{formatKobo(e.amountKobo)}</td>
										<td className="px-4 py-2 text-right">{balanceText(e.balanceKobo)}</td>
									</tr>
								))}
							</tbody>
							<tfoot><tr className="border-t border-border font-medium"><td className="px-4 py-2" colSpan={3}>Closing balance</td><td className="px-4 py-2 text-right">{balanceText(statement.closingKobo)}</td></tr></tfoot>
						</table>
					</div>
				</>
			)}
		</div>
	);
}

const Tile = ({ label, value }: { label: string; value: string }) => (
	<div className="rounded-lg border border-border bg-card/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-semibold">{value}</dd></div>
);

/** A negative running balance is money the school holds for the student. */
function balanceText(value: number | string): string {
	return toBigInt(value) < 0n ? `${formatKobo(String(-toBigInt(value)))} credit` : formatKobo(value);
}
