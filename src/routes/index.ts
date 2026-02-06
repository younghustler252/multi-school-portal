import { Router } from "express";


import authRoutes from "./auth.routes";
import schoolRoutes from "./school/school.routes";

const router = Router();


router.use('/auth', authRoutes);
router.use('/school', schoolRoutes);

export default router;

