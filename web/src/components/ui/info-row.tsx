export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
		</div>
	);
}