import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

interface AppButtonProps
	extends ComponentProps<typeof Button>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
	iconLeft?: React.ReactNode;
	iconRight?: React.ReactNode;
}

export function AppButton({
	loading,
	iconLeft,
	iconRight,
	children,
	disabled,
	...props
}: AppButtonProps) {
	return (
		<Button disabled={loading || disabled} {...props}>
			{loading ? (
				<Loader2 className="animate-spin" />
			) : (
				iconLeft
			)}
			{children}
			{!loading && iconRight}
		</Button>
	);
}