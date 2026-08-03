"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { STAFF_ROLE_LABELS } from "@/features/staff/constant/staff-role-labels";
import { StaffRole } from "@/features/staff/types/staff.types";

export default function StaffPage() {
	const [search, setSearch] = useState("");
	const [role, setRole] = useState<StaffRole | "all">("all");
	const [page, setPage] = useState(1);
	const debouncedSearch = useDebouncedValue(search, 400);

	const { data, isLoading } = useStaffList({
		page,
		limit: 20,
		search: debouncedSearch || undefined,
		role: role === "all" ? undefined : role,
	});

	return (
		<>
			<PageHeader
				title="Staff"
				description="Manage your school's staff accounts."
				actions={
					<Button nativeButton={false} render={<Link href="/school-admin/staff/new"><Plus className="size-4" /> Add staff</Link>} />
				}
			/>

			<div className="mb-4 flex flex-wrap items-center gap-2">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by name or email…"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="pl-9"
					/>
				</div>

				<Select value={role} onValueChange={(v) => { setRole(v as StaffRole | "all"); setPage(1); }}>
					<SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All roles</SelectItem>
						{Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>{label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Name</th>
							<th className="px-4 py-3 text-left">Role</th>
							<th className="px-4 py-3 text-left">Department</th>
							<th className="px-4 py-3 text-left">Email</th>
							<th className="px-4 py-3 text-left">Status</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border">
									<td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
								</tr>
							))}

						{!isLoading && data?.staff.length === 0 && (
							<tr>
								<td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
									No staff found.
								</td>
							</tr>
						)}

						{data?.staff.map((member) => (
							<tr key={member.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3">
									<Link href={`/school-admin/staff/${member.id}`} className="flex items-center gap-3">
										<div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
											{member.firstName?.charAt(0)}
											{member.lastName?.charAt(0)}
										</div>
										<span className="font-medium">
											{member.firstName} {member.lastName}
										</span>
									</Link>
								</td>
								<td className="px-4 py-3">
									<Badge variant="secondary">{STAFF_ROLE_LABELS[member.role]}</Badge>
								</td>
								<td className="px-4 py-3 text-muted-foreground">{member.department ?? "—"}</td>
								<td className="px-4 py-3 text-muted-foreground">{member.email ?? "—"}</td>
								<td className="px-4 py-3">
									<Badge variant={member.isActive ? "default" : "secondary"}>
										{member.isActive ? "Active" : "Inactive"}
									</Badge>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{data?.meta && data.meta.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
					<span>Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} staff)</span>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
						<Button variant="outline" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
					</div>
				</div>
			)}
		</>
	);
}