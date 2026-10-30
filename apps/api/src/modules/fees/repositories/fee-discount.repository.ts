import { FeeDiscountRuleEntity, FeeDiscountRuleFilters, StudentDiscountEntity } from "../domain/fee.entity";

export interface IFeeDiscountRepository {
    findRule(id: string): Promise<FeeDiscountRuleEntity | null>;
    listRules(filters: FeeDiscountRuleFilters): Promise<FeeDiscountRuleEntity[]>;
    createRule(data: Record<string, any>): Promise<FeeDiscountRuleEntity>;
    updateRule(id: string, data: Record<string, any>): Promise<FeeDiscountRuleEntity>;
    deleteRule(id: string): Promise<FeeDiscountRuleEntity>;                           // soft delete
    countAssignments(ruleId: string): Promise<number>;                                // students that still have it
    listForStudent(studentId: string): Promise<StudentDiscountEntity[]>;
    findAssignment(id: string): Promise<StudentDiscountEntity | null>;
    findSameAssignment(studentId: string, ruleId: string, sessionId: string | null): Promise<StudentDiscountEntity | null>;
    assign(data: Record<string, any>): Promise<StudentDiscountEntity>;
    removeAssignment(id: string): Promise<StudentDiscountEntity>;                     // soft delete
    studentExists(id: string): Promise<boolean>;
    sessionExists(id: string): Promise<boolean>;
    feeTypeExists(id: string): Promise<boolean>;
}
