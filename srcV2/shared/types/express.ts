import { UserRole } from "../../domain/enums/user-role";
import { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string;
        tenantId: string;
        role: UserRole;
      };
    }
  }
}

export {};
