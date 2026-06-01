
import { PlatformRole } from "../../domain/entities/user.entity";
import { SchoolRole } from "../../domain/entities/membership.entity";

export interface AccessTokenPayload {
	sub: string;
	platformRole: PlatformRole;
	schoolId?: string;
	schoolRole?: SchoolRole;
}

export interface IJwtService {
	signAccessToken(payload: AccessTokenPayload): string;
	verifyAccessToken(token: string): AccessTokenPayload;

	signRefreshToken(userId: string): string;
	verifyRefreshToken(token: string): { sub: string };
}