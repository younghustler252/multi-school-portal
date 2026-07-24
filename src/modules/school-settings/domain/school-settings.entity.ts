export interface SchoolSettingsEntity {
    id:            string;
    logoUrl:       string | null;
    primaryColor:  string | null;
    secondaryColor: string | null;
    motto:         string | null;
    address:       string | null;
    website:       string | null;
    foundedYear:   number | null;
    principalName: string | null;
    stamp:         string | null;
    signature:     string | null;
    createdAt:     Date;
    updatedAt:     Date;
}