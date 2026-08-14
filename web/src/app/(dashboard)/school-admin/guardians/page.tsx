"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuardians, useBulkInviteGuardians } from "@/features/guardians/hooks/use-guardians";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiErrorResponse } from "@/types/api-response";

export default function GuardiansPage() {
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const debouncedSearch = useDebouncedValue(search, 400);

	const { data, isLoading } = useGuardians({ limit: 100, search: debouncedSearch || undefined });
	const bulkInvite = useBulkInviteGuardians();

	const uninvited = data?.guardians.filter((g) => !g.userId) ?? [];

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}

	function toggleAll() {
		setSelected((prev) =>
			prev.size === uninvited.length ? new Set() : new Set(uninvited.map((g) => g.id))
		);
	}

	async function handleBulkInvite() {
		try {
			const result = await bulkInvite.mutateAsync(Array.from(selected));
			toast.success(`${result.sent} invite${result.sent !== 1 ? "s" : ""} sent${result.skipped ? `, ${result.skipped} already had accounts` : ""}`);
			setSelected(new Set());
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send invites");
		}
	}

	return (
		<>
			<PageHeader
				title="Guardians"
				description={`${data?.guardians.length ?? 0} linked accounts`}
				actions={
					<Button nativeButton={false} render={<Link href="/school-admin/guardians/new"><Plus className="size-4" /> Add guardian</Link>} />
				}
			/>

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				<div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
					<div className="relative max-w-sm flex-1">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search by name or email…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>

					{selected.size > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">{selected.size} selected</span>
							<Button size="sm" variant="outline" onClick={handleBulkInvite} disabled={bulkInvite.isPending}>
								<UserCheck className="size-3.5" /> {bulkInvite.isPending ? "Sending…" : "Send invites"}
							</Button>
						</div>
					)}
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="w-8 p-3">
									<input
										type="checkbox"
										checked={uninvited.length > 0 && selected.size === uninvited.length}
										onChange={toggleAll}
										className="size-4 accent-primary"
									/>
								</th>
								<th className="px-2 py-3 text-left">Name</th>
								<th className="px-2 py-3 text-left">Email</th>
								<th className="px-2 py-3 text-left">Phone</th>
								<th className="px-2 py-3 text-left">Portal access</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								Array.from({ length: 5 }).map((_, i) => (
									<tr key={i} className="border-t border-border"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
								))}

							{!isLoading && data?.guardians.length === 0 && (
								<tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No guardians found.</td></tr>
							)}

							{data?.guardians.map((guardian) => (
								<tr key={guardian.id} className="border-t border-border hover:bg-muted/30">
									<td className="p-3">
										{!guardian.userId && (
											<input
												type="checkbox"
												checked={selected.has(guardian.id)}
												onChange={() => toggle(guardian.id)}
												className="size-4 accent-primary"
											/>
										)}
									</td>
									<td className="px-2 py-3">
										<Link href={`/school-admin/guardians/${guardian.id}`} className="font-medium">
											{guardian.firstName} {guardian.lastName}
										</Link>
									</td>
									<td className="px-2 py-3 text-muted-foreground">{guardian.email}</td>
									<td className="px-2 py-3 text-muted-foreground">{guardian.phone ?? "—"}</td>
									<td className="px-2 py-3">
										<Badge variant={guardian.userId ? "default" : "secondary"}>
											{guardian.userId ? "Active" : "Not invited"}
										</Badge>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}