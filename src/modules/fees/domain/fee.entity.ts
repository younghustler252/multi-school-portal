export type FeeStudentType = "ALL" | "NEW" | "RETURNING";
export type FeeDiscountType = "PERCENT" | "FIXED";
export type FeeDiscountKind = "SIBLING" | "STAFF_CHILD" | "SCHOLARSHIP" | "EARLY_PAYMENT" | "CUSTOM";

export interface FeeTypeEntity {
    id: string; code: string; name: string; description: string | null;
    incomeAccountId: string; incomeAccountCode: string | null; incomeAccountName: string | null;
    isRefundable: boolean; isActive: boolean; sortOrder: number; createdAt: Date; deletedAt: Date | null;
}

export interface FeeStructureItemEntity {
    id: string; feeTypeId: string; feeTypeCode: string; feeTypeName: string; amountKobo: bigint; sortOrder: number;
}

export interface FeeStructureEntity {
    id: string; name: string; sessionId: string; termId: string; classId: string | null; branchId: string | null;
    studentType: FeeStudentType; dueDate: Date | null; description: string | null; isActive: boolean;
    items: FeeStructureItemEntity[]; createdAt: Date; deletedAt: Date | null;
}

export interface FeeDiscountRuleEntity {
    id: string; name: string; kind: FeeDiscountKind; type: FeeDiscountType; value: bigint; feeTypeId: string | null;
    isActive: boolean; createdAt: Date; deletedAt: Date | null;
}

export interface StudentDiscountEntity {
    id: string; studentId: string; ruleId: string; ruleName: string | null; sessionId: string | null; note: string | null; createdAt: Date; deletedAt: Date | null;
}

export interface FeeTypeFilters { status: "active" | "inactive" | "all"; q?: string }
export interface FeeStructureFilters { sessionId?: string; termId?: string; classId?: string; branchId?: string; status: "active" | "inactive" | "all" }
export interface FeeDiscountRuleFilters { status: "active" | "inactive" | "all"; kind?: FeeDiscountKind }
