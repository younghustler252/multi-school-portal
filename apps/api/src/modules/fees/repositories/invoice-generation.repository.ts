import { DiscountInput, EnrolledStudent, TermInfo } from "../domain/invoice.entity";

/* The questions invoice generation asks about students, enrolments and discounts. Read-only. */
export interface IInvoiceGenerationRepository {
    termInfo(termId: string): Promise<TermInfo | null>;
    enrolledStudents(termId: string, filter: { classId?: string; studentIds?: string[] }): Promise<EnrolledStudent[]>;   // active students with an active enrolment in the term
    studentBranchId(studentId: string): Promise<string | null>;                                                         // null = no such student
    studentsWithEarlierEnrolment(studentIds: string[], before: Date): Promise<Set<string>>;                             // returning students: enrolled in an earlier term
    activeDiscounts(studentIds: string[], sessionId: string): Promise<Map<string, DiscountInput[]>>;                     // per student, oldest first
    studentExists(id: string): Promise<boolean>;
}
