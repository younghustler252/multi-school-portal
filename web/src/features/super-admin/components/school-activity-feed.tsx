"use client";

import {
	Activity,
	LogIn,
	UserPlus,
	UserRoundCog,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolActivity } from "../hooks/use-school-management";

const formatActivityAction = (action: string) => {
	switch (action) {
		case "user.login":
			return "Signed in";

		case "staff.created":
			return "Created a staff member";

		case "staff.updated":
			return "Updated a staff member";

		case "staff.deleted":
			return "Removed a staff member";

		default:
			return action
				.replace(/\./g, " ")
				.replace(/\b\w/g, (char) => char.toUpperCase());
	}
};

const getActivityIcon = (action: string) => {
	switch (action) {
		case "user.login":
			return LogIn;

		case "staff.created":
			return UserPlus;

		case "staff.updated":
			return UserRoundCog;

		default:
			return Activity;
	}
};

const formatActivityDate = (date: string) => {
	return new Date(date).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

export function SchoolActivityFeed({
	schoolId,
}: {
	schoolId: string;
}) {
	const { data, isLoading } = useSchoolActivity(schoolId, {
		limit: 10,
	});

	if (isLoading) {
		return <Skeleton className="h-40 rounded-xl" />;
	}

	const entries = data?.entries ?? [];

	return (
		<div className="rounded-xl border border-border bg-card/80 p-6">
			<div className="mb-5 flex items-center gap-2 font-medium">
				<Activity className="size-4" />
				Recent activity
			</div>

			{entries.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No activity recorded yet.
				</p>
			) : (
				<ul className="space-y-5">
					{entries.map((entry) => {
						const Icon = getActivityIcon(entry.action);

						return (
							<li
								key={entry.id}
								className="flex gap-3"
							>
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
									<Icon className="size-4 text-muted-foreground" />
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-3">
										<p className="truncate text-sm font-medium text-foreground">
											{entry.actorName}
										</p>

										<time
											className="shrink-0 text-xs text-muted-foreground"
											dateTime={entry.createdAt}
										>
											{formatActivityDate(
												entry.createdAt,
											)}
										</time>
									</div>

									<p className="mt-0.5 text-sm text-muted-foreground">
										{formatActivityAction(
											entry.action,
										)}
									</p>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
