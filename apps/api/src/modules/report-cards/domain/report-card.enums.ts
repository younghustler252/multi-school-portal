export enum ReportCardStatus {
    DRAFT     = "draft",
    GENERATED = "generated",
    PUBLISHED = "published",
    SENT      = "sent",
}

export enum ReportCardErrorMessage {
    NOT_FOUND        = "Report card not found",
    ALREADY_EXISTS   = "Report card already exists for this student and term",
    GRADES_NOT_FOUND = "No published grades found for this student",
    PDF_FEATURE      = "Report card PDF requires Basic plan or above",
}