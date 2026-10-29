import type { MessageChannel } from "./template-engine";

/*
|--------------------------------------------------------------------------
| TEMPLATE CATALOG (code)
| The messages the platform can send for a school, each with the placeholders it may use, sample values for the
| preview, and the DEFAULT text for every channel. A school can replace the text of any channel (stored in the tenant
| table SchoolMessageTemplate); deleting its version brings the default back. A school never adds new keys or new
| placeholders: the catalog decides what a message can carry.
| Other modules (attendance, report cards) add their own entries here when they are switched on.
|--------------------------------------------------------------------------
*/
export interface TemplateVariable { name: string; label: string; sample: string }

export interface TemplateDef {
    key:         string;
    name:        string;
    description: string;
    /** The notification type this message is stored as (SchoolNotificationType). */
    notificationType: "fee_reminder" | "fee_invoice" | "broadcast";
    variables:   readonly TemplateVariable[];
    defaults:    Record<MessageChannel, { subject: string | null; body: string }>;
}

const FEE_VARIABLES: readonly TemplateVariable[] = [
    { name: "guardian_name",  label: "Guardian's first name",  sample: "Mrs. Adeyemi" },
    { name: "student_name",   label: "Student's name",         sample: "Tolu Adeyemi" },
    { name: "school_name",    label: "School name",            sample: "Your School" },
    { name: "amount_due",     label: "Amount still owing",     sample: "₦45,000.00" },
    { name: "due_date",       label: "Invoice due date",       sample: "15 Nov 2026" },
    { name: "invoice_number", label: "Invoice number",         sample: "INV-0042" },
];

export const TEMPLATE_CATALOG: readonly TemplateDef[] = [
    {
        key: "fee.reminder", name: "Fee reminder (due soon)", notificationType: "fee_reminder", variables: FEE_VARIABLES,
        description: "Sent to a student's guardians shortly before an invoice is due.",
        defaults: {
            IN_APP: { subject: "Fee payment reminder", body: "A fee payment of {{amount_due}} for {{student_name}} is due on {{due_date}}. Please log in to view the invoice and make payment." },
            EMAIL:  { subject: "Fee payment reminder", body: "Hi {{guardian_name}},\n\nThis is a reminder that a fee payment of {{amount_due}} for {{student_name}} is due on {{due_date}} (invoice {{invoice_number}}).\n\nPlease log in to your parent portal to view the full invoice and make payment.\n\n— {{school_name}}" },
            SMS:    { subject: null, body: "{{school_name}}: a fee of {{amount_due}} for {{student_name}} is due on {{due_date}}. Please pay through the parent portal." },
        },
    },
    {
        key: "fee.overdue", name: "Fee overdue notice", notificationType: "fee_reminder", variables: FEE_VARIABLES,
        description: "Sent to a student's guardians when an invoice is past its due date and still unpaid.",
        defaults: {
            IN_APP: { subject: "Fee payment overdue", body: "The fee of {{amount_due}} for {{student_name}} was due on {{due_date}} and is now overdue. Please make payment as soon as you can." },
            EMAIL:  { subject: "Fee payment overdue", body: "Hi {{guardian_name}},\n\nThe fee of {{amount_due}} for {{student_name}} was due on {{due_date}} (invoice {{invoice_number}}) and is now overdue.\n\nPlease log in to your parent portal to make payment, or contact the school office if you have already paid.\n\n— {{school_name}}" },
            SMS:    { subject: null, body: "{{school_name}}: the fee of {{amount_due}} for {{student_name}} was due on {{due_date}} and is overdue. Please pay through the parent portal." },
        },
    },
];

export const TEMPLATE_BY_KEY: ReadonlyMap<string, TemplateDef> = new Map(TEMPLATE_CATALOG.map(t => [t.key, t]));

export const variableNames = (def: TemplateDef): string[] => def.variables.map(v => v.name);
export const sampleValues = (def: TemplateDef): Record<string, string> => Object.fromEntries(def.variables.map(v => [v.name, v.sample]));
export const CHANNELS: readonly MessageChannel[] = ["IN_APP", "EMAIL", "SMS"];
