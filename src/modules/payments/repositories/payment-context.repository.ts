import { PaymentPerson, SchoolHeader } from "../domain/payment.entity";

/* Small read-only questions a payment asks about people and the school. */
export interface IPaymentContextRepository {
    guardianExists(id: string): Promise<boolean>;
    guardianChildIds(guardianId: string): Promise<string[]>;
    students(ids: string[]): Promise<PaymentPerson[]>;                      // the ones that exist
    attachmentExists(id: string): Promise<boolean>;
    guardianContact(guardianId: string): Promise<{ email: string; name: string; phone: string | null } | null>;
    subaccountCode(schoolId: string): Promise<string | null>;                // the school's gateway sub-account, when it has one
    schoolHeader(schoolId: string): Promise<SchoolHeader>;
}
