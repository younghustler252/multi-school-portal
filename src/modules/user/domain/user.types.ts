// Who is acting, taken from req.auth (never from the body)
export interface UserActionContext {
    userId:         string;
    schoolId:       string | null;     // null = platform session
    membershipId:   string | null;
    impersonatedBy?: string;
    ip:             string;
    userAgent:      string | null;
}
