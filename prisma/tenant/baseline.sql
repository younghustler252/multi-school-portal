-- Tenant Schema Baseline
-- Applied to every new school schema on provisioning

CREATE TABLE IF NOT EXISTS "Session" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Term" (
    "id"        TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Term_sessionId_fkey" FOREIGN KEY ("sessionId")
        REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id"          TEXT NOT NULL,
    "termId"      TEXT,
    "sessionId"   TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3),
    "type"        TEXT NOT NULL DEFAULT 'event',
    "isHoliday"   BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Staff" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "employeeId"    TEXT,
    "department"    TEXT,
    "designation"   TEXT,
    "qualification" TEXT,
    "gender"        TEXT,
    "dateOfBirth"   TIMESTAMP(3),
    "address"       TEXT,
    "joinDate"      TIMESTAMP(3),
    "role"          TEXT NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Staff_userId_key" UNIQUE ("userId"),
    CONSTRAINT "Staff_employeeId_key" UNIQUE ("employeeId")
);

CREATE TABLE IF NOT EXISTS "Student" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT,
    "admissionNumber" TEXT,
    "firstName"       TEXT NOT NULL,
    "lastName"        TEXT NOT NULL,
    "middleName"      TEXT,
    "dateOfBirth"     TIMESTAMP(3),
    "gender"          TEXT,
    "bloodGroup"      TEXT,
    "address"         TEXT,
    "photoUrl"        TEXT,
    "religion"        TEXT,
    "nationality"     TEXT DEFAULT 'Nigerian',
    "stateOfOrigin"   TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "admittedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Student_userId_key" UNIQUE ("userId"),
    CONSTRAINT "Student_admissionNumber_key" UNIQUE ("admissionNumber")
);

CREATE TABLE IF NOT EXISTS "Guardian" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT,
    "firstName"  TEXT NOT NULL,
    "lastName"   TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "phone"      TEXT,
    "occupation" TEXT,
    "address"    TEXT,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Guardian_userId_key" UNIQUE ("userId")
);

CREATE TABLE IF NOT EXISTS "StudentGuardian" (
    "id"         TEXT NOT NULL,
    "studentId"  TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relation"   TEXT NOT NULL,
    "isPrimary"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentGuardian_studentId_guardianId_key"
        UNIQUE ("studentId", "guardianId"),
    CONSTRAINT "StudentGuardian_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentGuardian_guardianId_fkey"
        FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Class" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "level"     TEXT,
    "capacity"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Subject" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "code"        TEXT,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subject_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "Subject_code_key" UNIQUE ("code")
);

CREATE TABLE IF NOT EXISTS "ClassSubject" (
    "id"        TEXT NOT NULL,
    "classId"   TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffId"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassSubject_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassSubject_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassSubject_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Enrolment" (
    "id"        TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId"   TEXT NOT NULL,
    "termId"    TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Enrolment_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "Enrolment_studentId_termId_key" UNIQUE ("studentId", "termId"),
    CONSTRAINT "Enrolment_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrolment_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "Class"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrolment_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Attendance" (
    "id"        TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId"    TEXT NOT NULL,
    "date"      TIMESTAMP(3) NOT NULL,
    "status"    TEXT NOT NULL,
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_pkey"               PRIMARY KEY ("id"),
    CONSTRAINT "Attendance_studentId_date_key" UNIQUE ("studentId", "date"),
    CONSTRAINT "Attendance_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GradingConfig" (
    "id"        TEXT NOT NULL,
    "minScore"  DOUBLE PRECISION NOT NULL,
    "maxScore"  DOUBLE PRECISION NOT NULL,
    "grade"     TEXT NOT NULL,
    "remark"    TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Grade" (
    "id"             TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "termId"         TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "caScore"        DOUBLE PRECISION,
    "examScore"      DOUBLE PRECISION,
    "total"          DOUBLE PRECISION,
    "grade"          TEXT,
    "remark"         TEXT,
    "position"       INTEGER,
    "totalStudents"  INTEGER,
    "isPublished"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Grade_studentId_termId_classSubjectId_key"
        UNIQUE ("studentId", "termId", "classSubjectId"),
    CONSTRAINT "Grade_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Grade_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Grade_classSubjectId_fkey"
        FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ReportCard" (
    "id"              TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "termId"          TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "teacherRemark"   TEXT,
    "principalRemark" TEXT,
    "totalScore"      DOUBLE PRECISION,
    "averageScore"    DOUBLE PRECISION,
    "position"        INTEGER,
    "totalStudents"   INTEGER,
    "pdfUrl"          TEXT,
    "emailSentAt"     TIMESTAMP(3),
    "smsSentAt"       TIMESTAMP(3),
    "generatedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportCard_pkey"               PRIMARY KEY ("id"),
    CONSTRAINT "ReportCard_studentId_termId_key" UNIQUE ("studentId", "termId"),
    CONSTRAINT "ReportCard_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReportCard_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "FeeType" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeeType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeeInvoice" (
    "id"          TEXT NOT NULL,
    "studentId"   TEXT NOT NULL,
    "termId"      TEXT NOT NULL,
    "feeTypeId"   TEXT NOT NULL,
    "amountKobo"  INTEGER NOT NULL,
    "paidKobo"    INTEGER NOT NULL DEFAULT 0,
    "balanceKobo" INTEGER NOT NULL DEFAULT 0,
    "status"      TEXT NOT NULL DEFAULT 'unpaid',
    "dueDate"     TIMESTAMP(3),
    "note"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeeInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeeInvoice_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeInvoice_termId_fkey"
        FOREIGN KEY ("termId") REFERENCES "Term"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeInvoice_feeTypeId_fkey"
        FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id"               TEXT NOT NULL,
    "feeInvoiceId"     TEXT NOT NULL,
    "guardianId"       TEXT,
    "amountKobo"       INTEGER NOT NULL,
    "method"           TEXT NOT NULL,
    "channel"          TEXT,
    "reference"        TEXT,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "webhookVerified"  BOOLEAN NOT NULL DEFAULT false,
    "providerResponse" JSONB,
    "receiptUrl"       TEXT,
    "recordedById"     TEXT,
    "paidAt"           TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "Payment_reference_key" UNIQUE ("reference"),
    CONSTRAINT "Payment_feeInvoiceId_fkey"
        FOREIGN KEY ("feeInvoiceId") REFERENCES "FeeInvoice"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_guardianId_fkey"
        FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SchoolNotification" (
    "id"        TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "sentById"  TEXT NOT NULL,
    "metadata"  JSONB,
    "sentAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SchoolNotificationRecipient" (
    "id"             TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "studentId"      TEXT,
    "guardianId"     TEXT,
    "staffId"        TEXT,
    "channel"        TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "priority"       TEXT NOT NULL DEFAULT 'NORMAL',
    "retryCount"     INTEGER NOT NULL DEFAULT 0,
    "failedReason"   TEXT,
    "providerMsgId"  TEXT,
    "readAt"         TIMESTAMP(3),
    "deliveredAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolNotificationRecipient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolNotificationRecipient_notificationId_fkey"
        FOREIGN KEY ("notificationId") REFERENCES "SchoolNotification"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "SchoolSettings" (
    "id"             TEXT NOT NULL,
    "logoUrl"        TEXT,
    "primaryColor"   TEXT DEFAULT '#1a1a2e',
    "secondaryColor" TEXT,
    "motto"          TEXT,
    "address"        TEXT,
    "website"        TEXT,
    "foundedYear"    INTEGER,
    "principalName"  TEXT,
    "stamp"          TEXT,
    "signature"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- Seed one default settings record
INSERT INTO "SchoolSettings" (id, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), now(), now())
ON CONFLICT DO NOTHING;