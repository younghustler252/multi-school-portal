import { School } from "../domain/school.entity";
import { SchoolDocument } from "../models/school.document";

export class SchoolMapper {
    
    /**
     * DB → Domain
     */
    static toDomain(doc: SchoolDocument): School {
        return new School({
            id: doc._id.toString(),

            name: doc.name,
            slug: doc.slug,
            subdomain: doc.subdomain,
            schoolCode: doc.schoolCode,

            email: doc.email,
            phone: doc.phone,

            address: doc.address,
            city: doc.city,
            state: doc.state,
            country: doc.country,
            timezone: doc.timezone,

            logo: doc.logo,
            website: doc.website,

            schoolType: doc.schoolType,
            ownershipType: doc.ownershipType,

            status: doc.status,
            verificationStatus: doc.verificationStatus,
            subscriptionStatus: doc.subscriptionStatus,

            currentPlanId: doc.currentPlanId,
            studentLimit: doc.studentLimit,

            currentAcademicSession: doc.currentAcademicSession,
            currentTerm: doc.currentTerm,

            trialEndsAt: doc.trialEndsAt,
            verifiedAt: doc.verifiedAt,

            createdBy: doc.createdBy.toString(),

            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            deletedAt: doc.deletedAt,
        });
    }

    /**
     * Domain → DB (CREATE ONLY)
     * IMPORTANT: no id, no timestamps
     */
    static toPersistenceCreate(school: School): Record<string, any> {
        const props = school.getProps();

        return {
            name: props.name,
            slug: props.slug,
            subdomain: props.subdomain,
            schoolCode: props.schoolCode,

            email: props.email,
            phone: props.phone,

            address: props.address,
            city: props.city,
            state: props.state,
            country: props.country,
            timezone: props.timezone,

            logo: props.logo,
            website: props.website,

            schoolType: props.schoolType,
            ownershipType: props.ownershipType,

            status: props.status,
            verificationStatus: props.verificationStatus,
            subscriptionStatus: props.subscriptionStatus,

            currentPlanId: props.currentPlanId,
            studentLimit: props.studentLimit,

            currentAcademicSession: props.currentAcademicSession,
            currentTerm: props.currentTerm,

            trialEndsAt: props.trialEndsAt,

            createdBy: props.createdBy,
        };
    }

    /**
     * Domain → DB (UPDATE ONLY)
     * IMPORTANT: no createdBy, no createdAt
     */
    static toPersistenceUpdate(school: School): Record<string, any> {
        const props = school.getProps();

        return {
            name: props.name,
            slug: props.slug,
            subdomain: props.subdomain,

            email: props.email,
            phone: props.phone,

            address: props.address,
            city: props.city,
            state: props.state,
            country: props.country,
            timezone: props.timezone,

            logo: props.logo,
            website: props.website,

            schoolType: props.schoolType,
            ownershipType: props.ownershipType,

            status: props.status,
            verificationStatus: props.verificationStatus,
            subscriptionStatus: props.subscriptionStatus,

            currentPlanId: props.currentPlanId,
            studentLimit: props.studentLimit,

            currentAcademicSession: props.currentAcademicSession,
            currentTerm: props.currentTerm,

            trialEndsAt: props.trialEndsAt,
            verifiedAt: props.verifiedAt,

            updatedAt: new Date(),
        };
    }
}