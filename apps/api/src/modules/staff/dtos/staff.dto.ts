import { z } from "zod";
import { emailField } from "../../auth/dtos/common";

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().max(max);
const phone = z.string().trim().min(7).max(30);

// A date that must be in the past (date of birth) / any valid date
const pastDate = z.string().refine(v => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), "Enter a valid date in the past");
const anyDate  = z.string().refine(v => !Number.isNaN(Date.parse(v)), "Enter a valid date");

const employeeId = z.string().trim().regex(/^[A-Za-z0-9\-\/]{2,30}$/, "Use letters, numbers, - or /");
const category = z.enum(["teaching", "non_teaching"]);
const employmentType = z.enum(["full_time", "part_time", "contract", "volunteer"]);

export const CreateStaffDto = z.object({
    firstName:      z.string().trim().min(1).max(50),
    lastName:       z.string().trim().min(1).max(50),
    middleName:     text(50).optional(),
    email:          emailField.optional(),
    phone:          phone.optional(),
    gender:         z.enum(["male", "female"]).optional(),
    dateOfBirth:    pastDate.optional(),
    address:        text(200).optional(),
    department:     text(100).optional(),
    designation:    text(100).optional(),
    qualification:  text(200).optional(),
    category:       category.default("non_teaching"),
    employmentType: employmentType.default("full_time"),
    joinDate:       anyDate.optional(),
    employeeId:     employeeId.optional(),                       // made automatically when omitted
    branchIds:      z.array(id).min(1).max(50).optional(),       // defaults to the main branch (or the creator's own branch)
    confirmNotDuplicate: z.boolean().optional(),                 // "yes, a different person with the same name and phone"
    invite:         z.object({ roleId: id }).optional(),         // invite to the portal straight away
}).strict().superRefine((d, ctx) => {
    if (d.invite && !d.email) ctx.addIssue({ code: "custom", path: ["email"], message: "An email is needed to send an invitation" });
});

export const UpdateStaffDto = z.object({
    firstName:      z.string().trim().min(1).max(50).optional(),
    lastName:       z.string().trim().min(1).max(50).optional(),
    middleName:     text(50).nullable().optional(),
    email:          emailField.nullable().optional(),
    phone:          phone.nullable().optional(),
    gender:         z.enum(["male", "female"]).nullable().optional(),
    dateOfBirth:    pastDate.nullable().optional(),
    address:        text(200).nullable().optional(),
    department:     text(100).nullable().optional(),
    designation:    text(100).nullable().optional(),
    qualification:  text(200).nullable().optional(),
    category:       category.optional(),
    employmentType: employmentType.optional(),
    joinDate:       anyDate.nullable().optional(),
    employeeId:     employeeId.optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ListStaffQuery = z.object({
    page:           z.coerce.number().int().min(1).default(1),
    limit:          z.coerce.number().int().min(1).max(100).default(20),
    search:         z.string().trim().max(100).optional(),
    category:       category.optional(),
    employmentType: employmentType.optional(),
    department:     z.string().trim().max(100).optional(),
    branchId:       id.optional(),
    status:         z.enum(["active", "inactive", "all"]).default("active"),
});

export const SetStaffBranchesDto = z.object({
    branchIds:       z.array(id).min(1).max(50),
    primaryBranchId: id.optional(),
}).strict();

export const DeactivateStaffDto = z.object({
    exitDate:   anyDate.optional(),
    exitReason: text(300).optional(),
}).strict();

export const InviteStaffDto  = z.object({ roleId: id }).strict();
export const ChangeStaffRolesDto = z.object({ roleIds: z.array(id).min(1).max(5) }).strict();

export type CreateStaffDtoType      = z.infer<typeof CreateStaffDto>;
export type UpdateStaffDtoType      = z.infer<typeof UpdateStaffDto>;
export type ListStaffQueryType      = z.infer<typeof ListStaffQuery>;
export type SetStaffBranchesDtoType = z.infer<typeof SetStaffBranchesDto>;
export type DeactivateStaffDtoType  = z.infer<typeof DeactivateStaffDto>;
export type InviteStaffDtoType      = z.infer<typeof InviteStaffDto>;
export type ChangeStaffRolesDtoType = z.infer<typeof ChangeStaffRolesDto>;
