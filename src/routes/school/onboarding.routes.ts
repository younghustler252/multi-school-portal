import express  from 'express';
import { completeSchoolProfile, uploadDocument } from '../../controllers/school/school.onboarding.controller';
import { protect } from '../../middleware/auth';

const router = express.Router();
router.use(protect);


router.post('/complete-profile', completeSchoolProfile);

router.post('/upload-document', uploadDocument);


export default router;
