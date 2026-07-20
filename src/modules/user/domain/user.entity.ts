export interface UserProfileEntity {
    id:               string;
    email:            string;
    role:             string;
    firstName:        string | null;
    lastName:         string | null;
    phone:            string | null;
    photoUrl:         string | null;
    schoolId:         string | null;
    isEmailVerified:  boolean;
    lastLoginAt:      Date | null;
    passwordChangedAt: Date | null;
    createdAt:        Date;
    updatedAt:        Date;
}