// modules/classes/services/class-subject-resolution.service.ts
import { IClassRepository } from "../repositories/class.repository";
import { ISchoolSettingsRepository } from "../../school-settings/repositories/school-settings.repository";
import { ClassSubjectAssignmentSource } from "../domain/class.enums";
import { TeachingModel } from "../../school-settings/domain/school-settings.enums";


export interface ResolvedAssignment {
    staffId:     string;
    assignedVia: ClassSubjectAssignmentSource;
}

interface Dependencies {
    classRepository:          IClassRepository;
    schoolSettingsRepository: ISchoolSettingsRepository;
}

export class ClassSubjectResolutionService {
    private readonly classRepository:          IClassRepository;
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;

    constructor({ classRepository, schoolSettingsRepository }: Dependencies) {
        this.classRepository          = classRepository;
        this.schoolSettingsRepository = schoolSettingsRepository;
    }

    async resolve(
        classId: string,
        subjectId: string,
    ): Promise<ResolvedAssignment | null> {
        const subject = await this.classRepository.findSubjectById(subjectId);

        if (subject?.defaultTeacherId) {
            return {
                staffId: subject.defaultTeacherId,
                assignedVia: ClassSubjectAssignmentSource.auto_subject_default,
            };
        }

        const settings = await this.schoolSettingsRepository.find();

        if (settings?.teachingModel === TeachingModel.HOMEROOM) {
            const cls = await this.classRepository.findClassById(classId);

            if (cls?.classTeacherId) {
                return {
                    staffId: cls.classTeacherId,
                    assignedVia: ClassSubjectAssignmentSource.auto_homeroom,
                };
            }
        }

        return null;
    }

    // Carries forward the previous term's assignments as fresh rows (never
    // mutating the old term's rows, preserving history), then fills any
    // genuinely new class/subject pairings using the resolution rule above.
    async carryForwardAndSeed(
        classId: string,
        previousTermId: string | null,
        newTermId: string,
    ): Promise<void> {
        if (previousTermId) {
            const previousAssignments =
                await this.classRepository.findClassSubjectsByTerm(
                    classId,
                    previousTermId,
                );

            for (const assignment of previousAssignments) {
                const exists =
                    await this.classRepository.findClassSubject(
                        classId,
                        assignment.subjectId,
                        newTermId,
                    );

                if (exists) continue;

                await this.classRepository.assignSubject({
                    classId,
                    subjectId: assignment.subjectId,
                    staffId: assignment.staffId,
                    termId: newTermId,
                    assignedVia: assignment.assignedVia,
                });
            }
        }

        const allSubjects =
            await this.classRepository.findAllSubjects();

        for (const subject of allSubjects) {
            const exists =
                await this.classRepository.findClassSubject(
                    classId,
                    subject.id,
                    newTermId,
                );

            if (exists) continue;

            const resolved =
                await this.resolve(classId, subject.id);

            if (resolved) {
                await this.classRepository.assignSubject({
                    classId,
                    subjectId: subject.id,
                    staffId: resolved.staffId,
                    termId: newTermId,
                    assignedVia: resolved.assignedVia,
                });
            }
        }
    }

    // Re-resolves only the auto-tagged rows for one class, current term —
    // used when a class's homeroom teacher changes. Never touches "manual"
    // or "auto_subject_default" assignments.
    async recascadeHomeroom(
        classId: string,
        termId: string,
    ): Promise<void> {
        const rows =
            await this.classRepository.findClassSubjectsByTerm(
                classId,
                termId,
            );

        for (const row of rows) {
            if (
                row.assignedVia !==
                ClassSubjectAssignmentSource.auto_homeroom
            ) {
                continue;
            }

            const resolved =
                await this.resolve(classId, row.subjectId);

            if (
                resolved &&
                resolved.staffId !== row.staffId &&
                resolved.assignedVia ===
                    ClassSubjectAssignmentSource.auto_homeroom
            ) {
                await this.classRepository.updateClassSubject(row.id, {
                    staffId: resolved.staffId,
                    assignedVia: resolved.assignedVia,
                });
            }
        }
    }

    // Re-resolves only auto_subject_default rows for one subject, across
    // every class, current term only — used when a subject's default
    // teacher changes.
    async recascadeSubjectDefault(
        subjectId: string,
        termId: string,
    ): Promise<void> {
        const rows =
            await this.classRepository.findClassSubjectsBySubjectAndTerm(
                subjectId,
                termId,
            );

        for (const row of rows) {
            if (
                row.assignedVia !==
                ClassSubjectAssignmentSource.auto_subject_default
            ) {
                continue;
            }

            const resolved =
                await this.resolve(row.classId, subjectId);

            if (
                resolved &&
                resolved.staffId !== row.staffId &&
                resolved.assignedVia ===
                    ClassSubjectAssignmentSource.auto_subject_default
            ) {
                await this.classRepository.updateClassSubject(row.id, {
                    staffId: resolved.staffId,
                    assignedVia: resolved.assignedVia,
                });
            }
        }
    }
}
