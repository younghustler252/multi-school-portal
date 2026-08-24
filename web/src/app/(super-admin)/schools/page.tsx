"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSchools } from "@/features/super-admin/hooks/use-school-management";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { SCHOOL_STATUS_VARIANT, VERIFICATION_STATUS_LABELS } from "@/features/super-admin/constants/school-status-labels";

export default function AdminSchoolsPage() {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 400);
	const { data, isLoading } = useAdminSchools({ limit: 100, search: debouncedSearch || undefined });

	return (
		<>
			<PageHeader title="Schools" description={`${data?.schools.length ?? 0} schools on the platform`} />

			<div className="relative mb-4 max-w-sm">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input placeholder="Search schools…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
			</div>

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">School</th>
							<th className="px-4 py-3 text-left">Subdomain</th>
							<th className="px-4 py-3 text-left">Status</th>
							<th className="px-4 py-3 text-left">Verification</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 6 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}

						{data?.schools.map((school) => (
							<tr key={school.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3">
									<Link href={`/schools/${school.id}`} className="font-medium">{school.name}</Link>
								</td>
								<td className="px-4 py-3 text-muted-foreground">{school.subdomain}</td>
								<td className="px-4 py-3">
									<Badge variant={SCHOOL_STATUS_VARIANT[school.status] ?? "outline"} className="capitalize">{school.status}</Badge>
								</td>
								<td className="px-4 py-3 text-muted-foreground">{VERIFICATION_STATUS_LABELS[school.verificationStatus] ?? school.verificationStatus}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}