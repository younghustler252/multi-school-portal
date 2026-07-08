import "express-serve-static-core";
import "multer"; 

declare module "express-serve-static-core" {
    interface Request {
        user?: {
            id: string;
            email: string;
            role: string;
            schoolId: string | null;
        };
        tenantSchema?: string;
        schoolId?: string;
        
        // ── ADD THIS LINE FOR MULTER SUPPORT ──────────────────────────────
        file?: Express.Multer.File;
        files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
}

export {};
