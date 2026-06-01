// src/infrastructure/security/BcryptPasswordHasher.ts

import bcrypt from "bcryptjs";
import { IPasswordHasher } from "../../application/interface/password-hasher.interface";

export class BcryptPasswordHasher implements IPasswordHasher {
	private readonly saltRounds = 12; // production-standard

	async hash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	
	async compare(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}
}