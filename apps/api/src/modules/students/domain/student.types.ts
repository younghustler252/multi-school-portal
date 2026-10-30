// Who is doing the action. Comes ONLY from the verified session, never from the request body.
export interface StudentActor {
    userId: string;
}
