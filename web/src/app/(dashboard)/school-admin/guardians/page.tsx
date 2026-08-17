"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentCard } from "@/features/students/components/student-card";
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
					<Button nativeButton={false} render={<Link href="/school-admin/guardians/new"><Plus className="size-4" /> Add guardian</Link>} />
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

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Name</th>
							<th className="px-4 py-3 text-left">Email</th>
							<th className="px-4 py-3 text-left">Phone</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={3} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}

						{!isLoading && data?.guardians.length === 0 && (
							<tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">No guardians found.</td></tr>
						)}

						{data?.guardians.map((guardian) => (
							<tr key={guardian.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3">
									<Link href={`/school-admin/guardians/${guardian.id}`} className="font-medium">
										{guardian.firstName} {guardian.lastName}
									</Link>
								</td>
								<td className="px-4 py-3 text-muted-foreground">{guardian.email}</td>
								<td className="px-4 py-3 text-muted-foreground">{guardian.phone ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}