import { UserRole } from "./UserRole";
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
