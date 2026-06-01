import express from "express";
import { registerUser, loginUser } from "../controllers/auth/auth.controller";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema } from "../validations/auth";

const router = express.Router();

// Register Route
router.post("/register", validate(registerSchema), registerUser);

router.post("/login", validate(loginSchema), loginUser);


export default router;
