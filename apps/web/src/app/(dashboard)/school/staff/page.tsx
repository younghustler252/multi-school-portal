"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffCard } from "@/features/staff/components/staff-card";
import { CategoryFilterPills, StatusFilterPills, type CategoryFilter } from "@/features/staff/components/staff-filters";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import type { StaffStatusFilter } from "@/features/staff/types/staff.types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useAccess } from "@/lib/use-access";
import { ROUTES } from "@/lib/routes";

const PAGE_SIZE = 24;

export default function StaffPage() {
	const me = useAccess();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<CategoryFilter>("all");
	const [status, setStatus] = useState<StaffStatusFilter>("active");
	const [page, setPage] = useState(1);
	const debouncedSearch = useDebouncedValue(search, 400);

	// The server filters, scopes (all / my branches / me) and pages the directory; nothing is filtered client-side.
	const { data, isLoading } = useStaffList({
		page,
		limit: PAGE_SIZE,
		search: debouncedSearch || undefined,
		category: category === "all" ? undefined : category,
		status,
	});

	const total = data?.meta?.total ?? 0;
	const label = status === "all" ? "" : `${status} `;

	return (
		<>
			<PageHeader
				title="Staff"
				description={`${total} ${label}staff member${total === 1 ? "" : "s"}`}
				actions={me.can("staff.manage") ? <Button nativeButton={false} render={<Link href={ROUTES.school.staff.new}><Plus className="size-4" /> Add staff</Link>} /> : undefined}
			/>

			<div className="mb-4 space-y-3">
				<div className="relative max-w-sm">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search staff…"
						value={search}
						onChange={(e) => { setSearch(e.target.value); setPage(1); }}
						className="pl-9"
					/>
				</div>
				<CategoryFilterPills value={category} onChange={(v) => { setCategory(v); setPage(1); }} />
				<StatusFilterPills value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
			</div>

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
				</div>
			)}

			{!isLoading && data?.staff.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">No staff found.</div>
			)}

			{data && data.staff.length > 0 && (
				<>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{data.staff.map((s) => <StaffCard key={s.id} staff={s} />)}
					</div>
					{data.meta && data.meta.totalPages > 1 && (
						<div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
							<Button variant="outline" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
							<span>Page {data.meta.page} of {data.meta.totalPages}</span>
							<Button variant="outline" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
						</div>
					)}
				</>
			)}
		</>
	);
}
