// src/presentation/controllers/auth.controller.ts

import { Request, Response } from "express"
import { RegisterUserUseCase } from "../../../application/useCase/auth/register.use-case"
import { LoginUserUseCase } from "../../../application/useCase/auth/login-user.use-case"
import { VerifyUserUseCase } from "../../../application/useCase/auth/verify-user.use-case"
import { JwtTokenService } from "../../infrastructure/security/jwt-token.service"

export class AuthController {
	constructor(
		private readonly registerUserUseCase: RegisterUserUseCase,
		private readonly loginUserUseCase: LoginUserUseCase,
		private readonly verifyUserUseCase: VerifyUserUseCase,
		private readonly tokenService: JwtTokenService
	) {}

	// =============================
	// Register
	// =============================
	async register(req: Request, res: Response) {
		try {
			const user = await this.registerUserUseCase.execute({
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				email: req.body.email,
				password: req.body.password,
				schoolId: req.body.schoolId
			})

			return res.status(201).json({
				message: "Registration successful. Please verify your email.",
				userId: user.id
			})
		} catch (error: any) {
			return res.status(400).json({ message: error.message })
		}
	}

	// =============================
	// Login
	// =============================
	async login(req: Request, res: Response) {
		try {
			const user = await this.loginUserUseCase.execute({
				email: req.body.email,
				password: req.body.password,
				schoolId: req.body.schoolId
			})

			const token = this.tokenService.generate({
				userId: user.id,
				email: user.email
			})

			return res.status(200).json({
				token,
				user: {
					id: user.id,
					firstName: user.firstName,
					lastName: user.lastName,
					email: user.email
				}
			})
		} catch (error: any) {
			return res.status(401).json({ message: error.message })
		}
	}

	// =============================
	// Verify Email
	// =============================
	async verify(req: Request, res: Response) {
		try {
			const user = await this.verifyUserUseCase.execute({
				verificationToken: req.query.token as string
			})

			const token = this.tokenService.generate({
				userId: user.id,
				email: user.email
			})

			return res.status(200).json({
				message: "Email verified successfully",
				token
			})
		} catch (error: any) {
			return res.status(400).json({ message: error.message })
		}
	}
}