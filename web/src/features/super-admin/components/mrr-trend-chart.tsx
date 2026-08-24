import { formatNaira } from "@/lib/format-money";
import { MrrTrendEntry } from "../types/super-admin.types";

export function MrrTrendChart({ data }: { data: MrrTrendEntry[] }) {
	const max = Math.max(...data.map((d) => d.mrrKobo), 1);

	return (
		<div className="mt-4 flex h-48 items-end gap-3">
			{data.map((d) => (
				<div key={d.month} className="flex flex-1 flex-col items-center gap-2">
					<div className="text-[10px] text-muted-foreground">{formatNaira(d.mrrKobo)}</div>
					<div
						className="w-full rounded-md bg-primary/80 transition-colors hover:bg-primary"
						style={{ height: `${(d.mrrKobo / max) * 100}%`, minHeight: "4px" }}
					/>
					<div className="text-[11px] text-muted-foreground">{d.month}</div>
				</div>
			))}
		</div>
	);
}