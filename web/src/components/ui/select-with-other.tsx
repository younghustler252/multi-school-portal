"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SelectWithOtherProps {
	options: string[];
	value: string | undefined;
	onChange: (value: string) => void;
	placeholder?: string;
	otherLabel?: string;
}

export function SelectWithOther({ options, value, onChange, placeholder = "Select", otherLabel = "Other" }: SelectWithOtherProps) {
	const isKnownOption = value ? options.includes(value) : true;
	const [showOther, setShowOther] = useState(!isKnownOption && !!value);
	const [otherValue, setOtherValue] = useState(!isKnownOption ? value ?? "" : "");

	useEffect(() => {
		if (value && !options.includes(value)) {
			setShowOther(true);
			setOtherValue(value);
		}
	}, [value, options]);

	function handleSelectChange(v: string | null) {
		if (v === otherLabel) {
			setShowOther(true);
			onChange(otherValue);
		} else {
			setShowOther(false);
			onChange(v ?? "");
		}
	}

	return (
		<div className="space-y-2">
			<Select value={showOther ? otherLabel : (value ?? "")} onValueChange={handleSelectChange}>
				<SelectTrigger>
					<SelectValue placeholder={placeholder}>
						{(v: string | null) => v || placeholder}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
					<SelectItem value={otherLabel}>{otherLabel}</SelectItem>
				</SelectContent>
			</Select>

			{showOther && (
				<Input
					value={otherValue}
					onChange={(e) => {
						setOtherValue(e.target.value);
						onChange(e.target.value);
					}}
					placeholder={`Enter ${otherLabel.toLowerCase()}…`}
				/>
			)}
		</div>
	);
}
