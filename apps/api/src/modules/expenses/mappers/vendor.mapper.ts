import { IMapper } from "../../../infrastructure/repository/base.repository";
import { VendorEntity } from "../domain/expense.entity";

export interface VendorRow {
    id: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null; bankName: string | null;
    accountName: string | null; accountNumberEncrypted: string | null; accountNumberLast4: string | null; taxId: string | null; notes: string | null;
    isActive: boolean; createdAt: Date; updatedAt: Date;
}

/* The full account number never leaves the server: only the last four digits are shown. */
export class VendorMapper implements IMapper<VendorRow, VendorEntity> {
    toDomain(raw: VendorRow): VendorEntity {
        return {
            id: raw.id, name: raw.name, contactName: raw.contactName, phone: raw.phone, email: raw.email, address: raw.address, bankName: raw.bankName,
            accountName: raw.accountName, accountNumberLast4: raw.accountNumberLast4, hasAccountNumber: raw.accountNumberEncrypted !== null,
            taxId: raw.taxId, notes: raw.notes, isActive: raw.isActive, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }
    toResponse(e: VendorEntity) { return { ...e }; }
}
