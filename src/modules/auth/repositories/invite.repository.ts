// src/modules/auth/repositories/invite.repository.ts

import { InviteEntity } from "../domain/auth.entity";
import { Role }         from "../../../generated/prisma/client";

export interface IInviteRepository {
    findByToken(token: string):                      Promise<InviteEntity | null>;
    findByEmail(email: string):                      Promise<InviteEntity | null>;
    create(data: Record<string, any>):               Promise<InviteEntity>;
    markAccepted(id: string):                        Promise<InviteEntity>;
    deleteExpired():                                 Promise<void>;
    findBySchool(schoolId: string):                  Promise<InviteEntity[]>;
}