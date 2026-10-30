import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const blankOrText = (max: number) => z.string().trim().max(max);          // a blank clears the field on update

const vendorBody = {
    contactName:   blankOrText(100).optional(),
    phone:         blankOrText(30).optional(),
    email:         z.union([z.literal(""), z.string().trim().toLowerCase().email().max(150)]).optional(),
    address:       blankOrText(300).optional(),
    bankName:      blankOrText(100).optional(),
    accountName:   blankOrText(150).optional(),
    accountNumber: z.union([z.literal(""), z.string().regex(/^\d{10}$/, "The account number must be 10 digits")]).optional(),
    taxId:         blankOrText(50).optional(),
    notes:         blankOrText(500).optional(),
};

export const CreateVendorDto = z.object({ name: text(150), ...vendorBody }).strict();

export const UpdateVendorDto = z.object({ name: text(150).optional(), ...vendorBody }).strict()
    .refine(d => Object.keys(d).length > 0, "Send at least one field to change");

export const ListVendorsQuery = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["active", "inactive", "all"]).default("active"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateVendorDtoType = z.infer<typeof CreateVendorDto>;
export type UpdateVendorDtoType = z.infer<typeof UpdateVendorDto>;
export type ListVendorsQueryType = z.infer<typeof ListVendorsQuery>;
