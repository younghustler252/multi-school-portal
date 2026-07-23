import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { ISchoolRepository } from "../../repositories/school.repository";
import {
	NotFoundError,
} from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";

export interface SetupChecklist {
	schoolProfile: {
		completed: boolean;
		label: string;
	};
	logoUploaded: {
		completed: boolean;
		label: string;
	};
	documentsUploaded: {
		completed: boolean;
		label: string;
	};
	paymentSetup: {
		completed: boolean;
		label: string;
	};
	gradingConfigured: {
		completed: boolean;
		label: string;
	};
	staffAdded: {
		completed: boolean;
		label: string;
	};
	studentsAdded: {
		completed: boolean;
		label: string;
	};
	classesSetup: {
		completed: boolean;
		label: string;
	};
	firstEnrolment: {
		completed: boolean;
		label: string;
	};
	completionPercent: number;
}

interface Dependencies {
	schoolRepository: ISchoolRepository;
}

export class GetSetupChecklistUseCase {

	private readonly schoolRepository: ISchoolRepository;

	constructor({
		schoolRepository,
	}: Dependencies) {
		this.schoolRepository = schoolRepository;
	}

	async execute(
		schoolId: string
	): Promise<SetupChecklist> {

		const db = getTenantClient();

		const school = await this.schoolRepository.findById(schoolId);

		if (!school) {
			throw new NotFoundError(
				SchoolErrorMessage.NOT_FOUND
			);
		}

		const [
			staffCount,
			studentCount,
			classCount,
			enrolmentCount,
			documentCount,
			gradingCount,
		] = await Promise.all([
			db.staff.count(),
			db.student.count(),
			db.class.count(),
			db.enrolment.count(),
			this.schoolRepository
				.findDocumentsBySchoolId(schoolId)
				.then(documents => documents.length),
			db.gradingConfig.count({
				where: {
					isDefault: false,
				},
			}),
		]);

		const checks = {
			schoolProfile: {
				completed: !!school.name && !!school.phone,
				label: "Complete school profile",
			},
			logoUploaded: {
				completed: !!school.logoUrl,
				label: "Upload school logo",
			},
			documentsUploaded: {
				completed: documentCount > 0,
				label: "Upload verification documents",
			},
			paymentSetup: {
				completed: !!school.paystackSubaccountCode,
				label: "Setup payment collection",
			},
			gradingConfigured: {
				completed: gradingCount > 0,
				label: "Configure grading system",
			},
			staffAdded: {
				completed: staffCount > 0,
				label: "Add at least one staff member",
			},
			studentsAdded: {
				completed: studentCount > 0,
				label: "Add at least one student",
			},
			classesSetup: {
				completed: classCount > 0,
				label: "Create classes",
			},
			firstEnrolment: {
				completed: enrolmentCount > 0,
				label: "Enrol first student",
			},
		};

		const completed = Object
			.values(checks)
			.filter(check => check.completed)
			.length;

		const total = Object
			.keys(checks)
			.length;

		return {
			...checks,
			completionPercent: Math.round(
				(completed / total) * 100
			),
		};
	}

}