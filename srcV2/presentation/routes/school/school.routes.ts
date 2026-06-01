import { protect } from '../../middleware/auth';
import  express from "express";
import { getMySchool, updateMySchool } from "../../controllers/school/school.Controller";

const router = express.Router();


router.use(protect)

router.get("/me", getMySchool);

router.put("/me", updateMySchool)

export default router;
