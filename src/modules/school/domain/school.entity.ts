import { 
    SchoolStatus,
    VerificationStatus,
    SchoolType,
    OwnershipType,
    SubscriptionStatus,
} from "./school.enum";


export interface SchoolProps {
    id: string;

    name: string;
    slug: string;
    subdomain: string;
    schoolCode: string;

    email: string;
    phone?: string;

    address?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;

    logo?: string;
    website?: string;

    schoolType: SchoolType;
    ownershipType: OwnershipType;

    status: SchoolStatus;
    verificationStatus: VerificationStatus;
    subscriptionStatus: SubscriptionStatus;

    currentPlanId?: string;

    studentLimit?: number;

    currentAcademicSession?: string;
    currentTerm?: string;

    trialEndsAt?: Date;
    verifiedAt?: Date;

    createdBy: string;

    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export class School {
    constructor(private props: SchoolProps) {}

    getProps(): SchoolProps {
        return this.props;
    }

    get id(): string {
        return this.props.id;
    }

    get status(): SchoolStatus {
        return this.props.status;
    }

    activate(): void {
        this.props.status = SchoolStatus.ACTIVE;
    }

    suspend(): void {
        this.props.status = SchoolStatus.SUSPENDED;
    }

    verify(): void {
        this.props.verificationStatus = VerificationStatus.VERIFIED;
        this.props.verifiedAt = new Date();
    }

    canAccessPlatform(): boolean {
        return (
            this.props.status === SchoolStatus.ACTIVE &&
            this.props.subscriptionStatus === SubscriptionStatus.ACTIVE
        );
    }
}
