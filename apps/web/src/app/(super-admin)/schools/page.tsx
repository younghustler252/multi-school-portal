"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAdminSchools } from "@/features/super-admin/hooks/use-school-management";
import { formatNaira } from "@/lib/format-money";

const VERIFICATION_BADGE: Record<string, { icon: typeof ShieldCheck; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
	verified: { icon: ShieldCheck, label: "Verified", variant: "default" },
	under_review: { icon: Clock, label: "Under review", variant: "secondary" },
	unverified: { icon: ShieldAlert, label: "Unverified", variant: "outline" },
	rejected: { icon: ShieldAlert, label: "Rejected", variant: "destructive" },
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
	if (status === "active") return "secondary";
	if (status === "suspended" || status === "deactivated") return "destructive";
	return "default"; // pending
}

export default function AdminSchoolsPage() {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [verificationFilter, setVerificationFilter] = useState("all");

	const { data, isLoading } = useAdminSchools({
		search: search || undefined,
		status: statusFilter === "all" ? undefined : statusFilter,
		verificationStatus: verificationFilter === "all" ? undefined : verificationFilter,
		limit: 50,
	});

	const schools = data?.schools ?? [];

	return (
		<>
			<PageHeader
				title="Schools"
				description={`${data?.meta?.total ?? schools.length} schools on the platform`}
				actions={
					<Button
						className="w-full gap-2 sm:w-auto"
						nativeButton={false}
						render={<Link href="/schools/new"><Plus className="size-4" /> New school</Link>}
					/>
				}
			/>

			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<div className="relative flex-1 sm:max-w-sm">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search schools…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
					<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
						<SelectTrigger className="sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All status</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="suspended">Suspended</SelectItem>
							<SelectItem value="deactivated">Deactivated</SelectItem>
						</SelectContent>
					</Select>
					<Select value={verificationFilter} onValueChange={(v) => setVerificationFilter(v ?? "all")}>
						<SelectTrigger className="sm:w-36"><SelectValue placeholder="Verification" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All verification</SelectItem>
							<SelectItem value="verified">Verified</SelectItem>
							<SelectItem value="under_review">Under review</SelectItem>
							<SelectItem value="unverified">Unverified</SelectItem>
							<SelectItem value="rejected">Rejected</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Mobile: cards */}
			<div className="space-y-3 md:hidden">
				{isLoading &&
					Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

				{!isLoading && schools.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
						No schools match these filters.
					</div>
				)}

				{schools.map((school) => {
					const verification = VERIFICATION_BADGE[school.verificationStatus] ?? VERIFICATION_BADGE.unverified;
					const VerificationIcon = verification.icon;
					return (
						<Link key={school.id} href={`/schools/${school.id}`} className="block">
							<MobileCard>
								<MobileCardHeader
									title={school.name}
									subtitle={`${school.subdomain}.schoolos.app`}
									badge={<Badge variant={statusVariant(school.status)} className="capitalize">{school.status}</Badge>}
								/>
								<div className="mt-3 flex items-center justify-between text-sm">
									<Badge variant={school.planName ? "default" : "secondary"}>{school.planName ?? "No plan"}</Badge>
									<Badge variant={verification.variant} className="gap-1">
										<VerificationIcon className="size-3" /> {verification.label}
									</Badge>
								</div>
								<div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
									<span>{school.studentCount} students</span>
									<span>{formatNaira(school.mrrKobo)} MRR</span>
									<span>Joined {new Date(school.createdAt).toLocaleDateString()}</span>
								</div>
							</MobileCard>
						</Link>
					);
				})}
			</div>

			{/* Desktop: table */}
			<div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
				<table className="w-full text-sm">
					<thead className="bg-muted/30 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">School</th>
							<th className="text-left">Plan</th>
							<th className="text-right">Students</th>
							<th className="text-right">MRR</th>
							<th className="pl-6 text-left">Joined</th>
							<th className="text-center">Verification</th>
							<th className="text-center">Status</th>
							<th className="pr-4" />
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border">
									<td colSpan={8} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
								</tr>
							))}

						{!isLoading && schools.length === 0 && (
							<tr>
								<td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
									No schools match these filters.
								</td>
							</tr>
						)}

						{schools.map((school) => {
							const verification = VERIFICATION_BADGE[school.verificationStatus] ?? VERIFICATION_BADGE.unverified;
							const VerificationIcon = verification.icon;
							return (
								<tr key={school.id} className="border-t border-border hover:bg-muted/30">
									<td className="px-4 py-3">
										<Link href={`/schools/${school.id}`} className="font-medium hover:underline">
											{school.name}
										</Link>
										<div className="text-xs text-muted-foreground">{school.subdomain}.schoolos.app</div>
									</td>
									<td>
										<Badge variant={school.planName ? "default" : "secondary"}>{school.planName ?? "No plan"}</Badge>
									</td>
									<td className="text-right">{school.studentCount}</td>
									<td className="text-right text-muted-foreground">{formatNaira(school.mrrKobo)}</td>
									<td className="pl-6 text-muted-foreground">{new Date(school.createdAt).toLocaleDateString()}</td>
									<td className="text-center">
										<Badge variant={verification.variant} className="gap-1">
											<VerificationIcon className="size-3" /> {verification.label}
										</Badge>
									</td>
									<td className="text-center">
										<Badge variant={statusVariant(school.status)} className="capitalize">
											{school.status}
										</Badge>
									</td>
									<td className="pr-4 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger render={<Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>} />
											<DropdownMenuContent align="end">
												<DropdownMenuItem render={<Link href={`/schools/${school.id}`}>View details &amp; documents</Link>} />
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={() => router.push(`/schools/${school.id}?action=change-plan`)}>
													Change plan
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => router.push(`/schools/${school.id}?action=reset-password`)}>
													Reset admin password
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);	
}	