// routes/admin/userRoutes.ts
import { Router } from "express";
import {
	getAllUsers,
	createUser,
	getUserById,
	updateUser,
	deleteUser,
	assignRole,
	getSchoolAnalytics
} from "../../controllers/user/admin.controller";
import { authorize } from "../../middleware/authorize";
import { UserRole } from "../../types/UserRole";

const router = Router();

// All routes here are admin-only
router.use(authorize(UserRole.ADMIN, UserRole.ADMIN)); // only ADMIN and SUPERADMIN can access

// Get all users in the school
router.get("/", getAllUsers);

// Create new user
router.post("/", createUser); 

//Get school analytics
router.get("/analytics", getSchoolAnalytics);

// Get single user
router.get("/:id", getUserById);

// Update user
router.put("/:id", updateUser);

// Delete user
router.delete("/:id", deleteUser);

// Assign / change role
router.patch("/:id/role", assignRole);

export default router;
