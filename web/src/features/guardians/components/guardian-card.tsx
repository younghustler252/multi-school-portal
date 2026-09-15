import Link from "next/link";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import { Badge } from "@/components/ui/badge";
import { GuardianResponseData } from "../types/guardian.types";

export function GuardianCard({ guardian }: { guardian: GuardianResponseData }) {
	return (
		<Link href={`/school-admin/guardians/${guardian.id}`} className="block">
			<MobileCard>
				<MobileCardHeader
					title={`${guardian.firstName} ${guardian.lastName}`}
					subtitle={guardian.email}
					badge={<Badge variant={guardian.isActive ? "default" : "secondary"}>{guardian.isActive ? "Active" : "Inactive"}</Badge>}
				/>
				{guardian.phone && (
					<div className="mt-2 text-xs text-muted-foreground">{guardian.phone}</div>
				)}
			</MobileCard>
		</Link>
	);
}