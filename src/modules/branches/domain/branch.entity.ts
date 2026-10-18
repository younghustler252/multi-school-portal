export interface BranchEntity {
    id:               string;
    name:             string;
    code:             string;          // short, permanent identifier (used in numbering later: admission numbers, receipts)
    isMain:           boolean;         // every school has exactly one main branch
    address:          string | null;
    city:             string | null;
    state:            string | null;
    phone:            string | null;
    email:            string | null;
    principalStaffId: string | null;   // head of this branch (a Staff id)
    isActive:         boolean;
    deletedAt:        Date | null;
    createdAt:        Date;
    updatedAt:        Date;
}
