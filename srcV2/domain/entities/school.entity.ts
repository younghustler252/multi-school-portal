// domain/school/school.entity.ts

import {
   SubscriptionPlan,
   SchoolType,
   VerificationStatus,
   BillingStatus,
   VerificationDocumentType
} from "../enums/school.enum"

export type SchoolId = string
export type UserId = string

// ==============================
// 📄 Verification Document
// ==============================

export interface VerificationDocument {
   documentType: VerificationDocumentType
   fileUrl: string
   status: VerificationStatus
   verifiedAt?: Date
   verifiedBy?: UserId
   rejectionReason?: string
}

// ==============================
// 🧱 Creation Props
// ==============================

interface CreateSchoolProps {
   id: SchoolId
   name: string
   schoolType: SchoolType
   createdBy: UserId
   ownerId?: UserId | null
   contactEmail?: string
   timezone?: string
}

// ==============================
// ♻️ Rehydration Props
// ==============================

interface RehydrateSchoolProps extends CreateSchoolProps {
   slug?: string | null
   domain?: string | null
   address?: string | null
   logoUrl?: string | null
   features: Record<string, boolean>
   subscriptionPlan: SubscriptionPlan
   billingStatus: BillingStatus
   verificationStatus: VerificationStatus
   verificationDocuments: VerificationDocument[]
   isProfileComplete: boolean
   isActive: boolean
   createdAt: Date
   updatedAt: Date
}

// ==============================
// 🏫 School Aggregate Root
// ==============================

export class School {

   private constructor(
      public readonly id: SchoolId,
      public name: string,
      public schoolType: SchoolType,
      public createdBy: UserId,
      public ownerId: UserId | null,

      public slug: string | null,
      public domain: string | null,
      public address: string | null,
      public contactEmail: string | null,
      public logoUrl: string | null,
      public timezone: string,

      public features: Record<string, boolean>,
      public subscriptionPlan: SubscriptionPlan,
      public billingStatus: BillingStatus,

      public verificationStatus: VerificationStatus,
      private verificationDocuments: VerificationDocument[],

      public isProfileComplete: boolean,
      public isActive: boolean,

      public readonly createdAt: Date,
      public updatedAt: Date
   ) {}

   // ==============================
   // 🆕 Factory: Create
   // ==============================

   static create(props: CreateSchoolProps): School {
      return new School(
         props.id,
         props.name.trim(),
         props.schoolType,
         props.createdBy,
         props.ownerId ?? null,

         null, // slug
         null, // domain
         null, // address
         props.contactEmail ?? null,
         null, // logo
         props.timezone ?? "UTC",

         {}, // features
         SubscriptionPlan.FREE,
         BillingStatus.TRIAL,

         VerificationStatus.PENDING,
         [],

         false, // profile incomplete
         false, // inactive until verified

         new Date(),
         new Date()
      )
   }

   // ==============================
   // ♻️ Factory: Rehydrate
   // ==============================

   static rehydrate(props: RehydrateSchoolProps): School {
      return new School(
         props.id,
         props.name,
         props.schoolType,
         props.createdBy,
         props.ownerId ?? null,
         props.slug ?? null,
         props.domain ?? null,
         props.address ?? null,
         props.contactEmail ?? null,
         props.logoUrl ?? null,
         props.timezone ?? "UTC",
         props.features,
         props.subscriptionPlan,
         props.billingStatus,
         props.verificationStatus,
         props.verificationDocuments,
         props.isProfileComplete,
         props.isActive,
         props.createdAt,
         props.updatedAt
      )
   }

   // ==============================
   // 🧾 Profile Management
   // ==============================

   updateProfile(data: {
      name?: string
      address?: string
      contactEmail?: string
      logoUrl?: string
      timezone?: string
   }) {
      if (data.name) this.name = data.name.trim()
      if (data.address) this.address = data.address
      if (data.contactEmail) this.contactEmail = data.contactEmail.toLowerCase()
      if (data.logoUrl) this.logoUrl = data.logoUrl
      if (data.timezone) this.timezone = data.timezone

      this.touch()
   }

   markProfileComplete() {
      this.isProfileComplete = true
      this.touch()
   }

   // ==============================
   // 🔐 Activation Lifecycle
   // ==============================

   activate() {
      if (this.verificationStatus !== VerificationStatus.APPROVED) {
         throw new Error("School cannot be activated until verified.")
      }

      this.isActive = true
      this.touch()
   }

   deactivate() {
      this.isActive = false
      this.touch()
   }

   // ==============================
   // 💳 Subscription
   // ==============================

   changeSubscription(plan: SubscriptionPlan) {
      this.subscriptionPlan = plan
      this.touch()
   }

   updateBillingStatus(status: BillingStatus) {
      this.billingStatus = status
      this.touch()
   }

   // ==============================
   // 📄 Verification
   // ==============================

   addVerificationDocument(doc: VerificationDocument) {
      this.verificationDocuments.push(doc)
      this.touch()
   }

   approveVerification(adminId: UserId) {
      this.verificationStatus = VerificationStatus.APPROVED
      this.isActive = true
      this.touch()
   }

   rejectVerification(reason: string) {
      this.verificationStatus = VerificationStatus.REJECTED
      this.isActive = false
      this.touch()
   }

   getVerificationDocuments(): VerificationDocument[] {
      return [...this.verificationDocuments]
   }

   // ==============================
   // 🕒 Internal Timestamp
   // ==============================

   private touch() {
      this.updatedAt = new Date()
   }
}