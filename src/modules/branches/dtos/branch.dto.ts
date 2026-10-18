import { z } from "zod";
import { emailField } from "../../auth/dtos/common";

const id = z.string().min(1).max(64);

// A branch code is short and permanent: uppercase letters and digits only
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Use 2 to 6 letters or numbers");

export const CreateBranchDto = z.object({
    name:             z.string().trim().min(2).max(100),
    code:             code.optional(),                     // made from the name when omitted
    address:          z.string().trim().max(200).optional(),
    city:             z.string().trim().max(100).optional(),
    state:            z.string().trim().max(100).optional(),
    phone:            z.string().trim().min(7).max(30).optional(),
    email:            emailField.optional(),
    principalStaffId: id.optional(),
}).strict();

// The code is permanent, so it is not editable
export const UpdateBranchDto = z.object({
    name:             z.string().trim().min(2).max(100).optional(),
    address:          z.string().trim().max(200).nullable().optional(),
    city:             z.string().trim().max(100).nullable().optional(),
    state:            z.string().trim().max(100).nullable().optional(),
    phone:            z.string().trim().min(7).max(30).nullable().optional(),
    email:            emailField.nullable().optional(),
    principalStaffId: id.nullable().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

// Replaces the full set of branches a staff member works in
export const AssignBranchesDto = z.object({
    branchIds: z.array(id).min(1).max(50),
}).strict();

export type CreateBranchDtoType   = z.infer<typeof CreateBranchDto>;
export type UpdateBranchDtoType   = z.infer<typeof UpdateBranchDto>;
export type AssignBranchesDtoType = z.infer<typeof AssignBranchesDto>;
