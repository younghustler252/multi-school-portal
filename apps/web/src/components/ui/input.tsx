import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({
	className,
	type,
	...props
}: React.ComponentProps<typeof InputPrimitive>) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"flex h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-4 py-2 text-base shadow-sm transition-colors outline-none",
				"placeholder:text-muted-foreground",
				"file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
				"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
				"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
				"aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive",
				"md:text-sm",
				"dark:bg-input/30 dark:disabled:bg-input/80",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };