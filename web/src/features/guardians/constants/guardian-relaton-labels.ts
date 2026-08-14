import { GuardianRelation } from "@/features/guardians/types/guardian.types";

export const GUARDIAN_RELATION_LABELS: Record<GuardianRelation, string> = {
	father: "Father",
	mother: "Mother",
	uncle: "Uncle",
	aunt: "Aunt",
	grandparent: "Grandparent",
	sibling: "Sibling",
	guardian: "Guardian",
	other: "Other",
};