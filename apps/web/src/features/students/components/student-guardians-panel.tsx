"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Mail, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentGuardianLinkResponseData } from "../types/student.types";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constants/guardian-relation-labels";
import { LinkGuardianDialog } from "@/features/guardians/components/link-guardian-dialg";

type StudentGuardiansPanelProps = {
	studentId: string;
	guardians?: StudentGuardianLinkResponseData[];
};

export function StudentGuardiansPanel({
	studentId,
	guardians = [],
}: StudentGuardiansPanelProps) {
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);

	return (
		<>
			<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
				<div className="flex items-center justify-between gap-3">
					<h3 className="font-medium">Guardians</h3>

					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => setLinkDialogOpen(true)}
					>
						<Plus className="size-4" />
						Link guardian
					</Button>
				</div>

				{guardians.length === 0 ? (
					<p className="mt-3 text-sm text-muted-foreground">
						No guardians linked yet.
					</p>
				) : (
					<div className="mt-3 space-y-3">
						{guardians.map((g) => (
							<Link
								key={g.id}
								href={`/school-admin/guardians/${g.id}`}
								className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
							>
								<div className="flex items-center justify-between gap-2">
									<span className="text-sm font-medium">
										{g.firstName} {g.lastName}
									</span>

									{g.isPrimary && (
										<Badge className="shrink-0">
											Primary
										</Badge>
									)}
								</div>

								<div className="mt-0.5 text-xs text-muted-foreground">
									{GUARDIAN_RELATION_LABELS[g.relation]}
								</div>

								<div className="mt-2 space-y-1 text-xs text-muted-foreground">
									<div className="flex items-center gap-1.5">
										<Mail className="size-3 shrink-0" />
										{g.email}
									</div>

									{g.phone && (
										<div className="flex items-center gap-1.5">
											<Phone className="size-3 shrink-0" />
											{g.phone}
										</div>
									)}
								</div>
							</Link>
						))}
					</div>
				)}
			</div>

			<LinkGuardianDialog
				studentId={studentId}
				open={linkDialogOpen}
				onOpenChange={setLinkDialogOpen}
			/>
		</>
	);
}