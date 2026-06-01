import jwt from "jsonwebtoken";
import { IJwtService, AccessTokenPayload} from "../../application/interface/jwt-service.interface";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export class JwtService implements IJwtService {

	private getAccessSecret(): string {
		if (!process.env.JWT_ACCESS_SECRET) {
			throw new Error("JWT_ACCESS_SECRET not defined");
		}
		return process.env.JWT_ACCESS_SECRET;
	}

	private getRefreshSecret(): string {
		if (!process.env.JWT_REFRESH_SECRET) {
			throw new Error("JWT_REFRESH_SECRET not defined");
		}
		return process.env.JWT_REFRESH_SECRET;
	}

	signAccessToken(payload: AccessTokenPayload): string {
		return jwt.sign(payload, this.getAccessSecret(), {
			expiresIn: ACCESS_TOKEN_TTL,
		});
	}

	verifyAccessToken(token: string): AccessTokenPayload {
		try {
			return jwt.verify(
				token,
				this.getAccessSecret()
			) as AccessTokenPayload;
		} catch {
			throw new Error("Invalid or expired access token");
		}
	}

	signRefreshToken(userId: string): string {
		return jwt.sign(
			{ sub: userId },
			this.getRefreshSecret(),
			{ expiresIn: REFRESH_TOKEN_TTL }
		);
	}

	verifyRefreshToken(token: string): { sub: string } {
		try {
			return jwt.verify(
				token,
				this.getRefreshSecret()
			) as { sub: string };
		} catch {
			throw new Error("Invalid or expired refresh token");
		}
	}
}