/*
|--------------------------------------------------------------------------
| LEDGER CONSTANTS (shared by the templates, the provisioning seed and, later, the posting service)
|
| SYSTEM ACCOUNTS: every school gets these 17 accounts. The posting rules look them up by systemKey, so they
| can never be deleted, deactivated or change type. A school may rename them (brief, section 5.1).
|--------------------------------------------------------------------------
*/

export const REQUIRED_SYSTEM_KEYS = [
    "CASH_DEFAULT",
    "BANK_DEFAULT",
    "PETTY_CASH",
    "ONLINE_CLEARING",
    "FEES_RECEIVABLE",
    "ADVANCE_PAYMENTS",
    "ACCOUNTS_PAYABLE",
    "SALARIES_PAYABLE",
    "TAX_PAYABLE",
    "PENSION_PAYABLE",
    "STAFF_LOANS_RECEIVABLE",
    "OPENING_EQUITY",
    "DISCOUNTS_ALLOWED",
    "BAD_DEBT",
    "BANK_CHARGES",
    "SALARIES_EXPENSE",
    "EMPLOYER_PENSION_EXPENSE",
] as const;

export type SystemAccountKey = typeof REQUIRED_SYSTEM_KEYS[number];

// Accounts where money actually sits (or is on its way): payments land in these, and the cash book reads them
export const MONEY_SUBTYPES: ReadonlySet<string> = new Set(["CASH", "BANK", "PETTY_CASH", "ONLINE_CLEARING"]);

// Until the settings service exists: January, as the brief suggests (setting finance.fiscal_year_start_month)
export const DEFAULT_FISCAL_YEAR_START_MONTH = 1;

// Until the settings service exists: postings may not be dated after "today" in this time zone (Nigeria).
// Becomes the school's own time zone setting later.
export const FINANCE_TIMEZONE = "Africa/Lagos";
