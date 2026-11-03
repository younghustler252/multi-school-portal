// Who is doing the action. Comes ONLY from the verified session, never from the request body.
export interface StudentActor {
    userId: string;
    staffId?: string | null;      // the staff record of the person, when they are staff (used to pick their branch for a new student)
}
