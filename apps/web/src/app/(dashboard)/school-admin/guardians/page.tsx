"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GuardianCard } from "@/features/guardians/components/guardian-card";
import { useGuardians } from "@/features/guardians/hooks/use-guardians";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export default function GuardiansPage() {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 400);

	const { data, isLoading } = useGuardians({ limit: 100, search: debouncedSearch || undefined });

	return (
		<>
			<PageHeader
				title="Guardians"
				description={`${data?.guardians.length ?? 0} linked accounts`}
				actions={
					<Button
						nativeButton={false}
						className="w-full sm:w-auto"
						render={<Link href="/school-admin/guardians/new"><Plus className="size-4" /> Add guardian</Link>}
					/>
				}
			/>

			<div className="relative mb-4 max-w-sm">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search by name or email…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Mobile: cards */}
			<div className="space-y-2 md:hidden">
				{isLoading &&
					Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}

				{!isLoading && data?.guardians.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
						No guardians found.
					</div>
				)}

				{data?.guardians.map((guardian) => (
					<GuardianCard key={guardian.id} guardian={guardian} />
				))}
			</div>

			{/* Desktop: table */}
			<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Name</th>
							<th className="px-4 py-3 text-left">Email</th>
							<th className="px-4 py-3 text-left">Phone</th>
							<th className="px-4 py-3 text-left">Children</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}

						{!isLoading && data?.guardians.length === 0 && (
							<tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No guardians found.</td></tr>
						)}

						{data?.guardians.map((guardian) => (
							<tr key={guardian.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3">
									<Link href={`/school-admin/guardians/${guardian.id}`} className="font-medium">
										{/* title (Mr/Mrs) prepended here once confirmed on GuardianResponseData */}
										{guardian.firstName} {guardian.lastName}
									</Link>
								</td>
								<td className="px-4 py-3 text-muted-foreground">{guardian.email}</td>
								<td className="px-4 py-3 text-muted-foreground">{guardian.phone ?? "—"}</td>
								<td className="px-4 py-3 text-muted-foreground">
									{/* children names rendered here once the field/shape is confirmed */}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}