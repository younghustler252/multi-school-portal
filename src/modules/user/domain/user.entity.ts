import { UserRole, UserStatus } from "./user.enum.ts";

export interface UserProps {
    id: string;

    schoolId: string;

    firstname: string;
    lastname: string;
    othername?: string;

    email: string;
    phone?: string;

    password: string;

    role: UserRole;

    avatar?: string;

    gender?: string;
    dob?: Date;

    status: UserStatus;

    emailVerifiedAt?: Date;

    lastLoginAt?: Date;

    failedLoginAttempts?: number;

    isTwoFactorEnabled?: boolean;

    createdBy: string;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export class User {
    constructor(private props: UserProps) {}

    getProps(): UserProps {
        return this.props;
    }

    get id(): string {
        return this.props.id;
    }

    get email(): string {
        return this.props.email;
    }

    get role(): UserRole {
        return this.props.role;
    }

    get status(): UserStatus {
        return this.props.status;
    }

    activate(): void {
        this.props.status = UserStatus.ACTIVE;
    }

    suspend(): void {
        this.props.status = UserStatus.SUSPENDED;
    }

    verifyEmail(): void {
        this.props.emailVerifiedAt = new Date();
    }

    recordLogin(): void {
        this.props.lastLoginAt = new Date();
        this.props.failedLoginAttempts = 0;
    }

    registerFailedLogin(): void {
        this.props.failedLoginAttempts = (this.props.failedLoginAttempts || 0) + 1;
    }

    canLogin(): boolean {
        return this.props.status === UserStatus.ACTIVE;
    }
}