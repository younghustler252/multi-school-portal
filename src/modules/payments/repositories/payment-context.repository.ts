import { PaymentPerson, SchoolHeader } from "../domain/payment.entity";

/* Small read-only questions a payment asks about people and the school. */
export interface IPaymentContextRepository {
    guardianExists(id: string): Promise<boolean>;
    guardianChildIds(guardianId: string): Promise<string[]>;
    students(ids: string[]): Promise<PaymentPerson[]>;                      // the ones that exist
    attachmentExists(id: string): Promise<boolean>;
    schoolHeader(schoolId: string): Promise<SchoolHeader>;
}
