import { parse } from "csv-parse/sync";
import { IStudentRepository } from "../repositories/student.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { CreateGuardianUseCase } from "../../guardians/usecases/create-guardian.usecase";
import { ImportStudentRowSchema } from "../dtos/student.dto";

interface Dependencies {
	studentRepository: IStudentRepository;
	classRepository: IClassRepository;
	enrolmentRepository: IEnrolmentRepository;
	sessionRepository: ISessionRepository;
	createGuardianUseCase: CreateGuardianUseCase;
}

export interface ImportRowResult {
	row: number;
	status: "created" | "failed";
	reason?: string;
	studentId?: string;
}

export interface ImportStudentsResult {
	total: number;
	created: number;
	failed: number;
	results: ImportRowResult[];
}

export class ImportStudentsUseCase {
	private readonly studentRepository: IStudentRepository;
	private readonly classRepository: IClassRepository;
	private readonly enrolmentRepository: IEnrolmentRepository;
	private readonly sessionRepository: ISessionRepository;
	private readonly createGuardianUseCase: CreateGuardianUseCase;

	constructor(deps: Dependencies) {
		this.studentRepository = deps.studentRepository;
		this.classRepository = deps.classRepository;
		this.enrolmentRepository = deps.enrolmentRepository;
		this.sessionRepository = deps.sessionRepository;
		this.createGuardianUseCase = deps.createGuardianUseCase;
	}

	// ── Entry point: CSV file upload ──────────────────────────────────────
	async executeFromCsv(
		csvBuffer: Buffer,
		schoolId: string,
	): Promise<ImportStudentsResult> {
		const rawRows: any[] = parse(csvBuffer, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		});

		// Normalize common CSV/Excel input variations before validation.
		const normalizedRows = rawRows.map((row) => ({
			...row,

			gender: row.gender
				? String(row.gender).trim().toLowerCase()
				: undefined,

			guardianRelation: row.guardianRelation
				? String(row.guardianRelation).trim().toLowerCase()
				: undefined,
		}));

		return this.executeFromRows(normalizedRows, schoolId, 2);
	}

	// ── Entry point: raw JSON array ───────────────────────────────────────
	async executeFromRows(
		rawRows: any[],
		schoolId: string,
		startRow = 1,
	): Promise<ImportStudentsResult> {
		const currentTerm =
			await this.sessionRepository.findCurrentTerm();

		const results: ImportRowResult[] = [];

		for (let i = 0; i < rawRows.length; i++) {
			const rowNum = i + startRow;

			try {
				const row = ImportStudentRowSchema.parse(rawRows[i]);

				const student =
					await this.studentRepository.create({
						firstName: row.firstName,
						lastName: row.lastName,
						middleName: row.middleName,
						admissionNumber: row.admissionNumber,
						dateOfBirth: row.dateOfBirth
							? new Date(row.dateOfBirth)
							: null,
						gender: row.gender,
					});

				// ── Enrol student in class ────────────────────────────────
				if (row.className && currentTerm) {
					const cls =
						await this.classRepository.findClassByName(
							row.className,
						);

					if (cls) {
						await this.enrolmentRepository.create({
							studentId: student.id,
							classId: cls.id,
							termId: currentTerm.id,
							status: "active",
						});
					}
				}

				// ── Create guardian ──────────────────────────────────────
				if (
					row.guardianEmail &&
					row.guardianFirstName &&
					row.guardianLastName
				) {
					await this.createGuardianUseCase.execute(
						{
							studentId: student.id,
							firstName: row.guardianFirstName,
							lastName: row.guardianLastName,
							email: row.guardianEmail,
							phone: row.guardianPhone,
							relation:
								row.guardianRelation ??
								"guardian",
							isPrimary: true,
						},
						schoolId,
					);
				}

				results.push({
					row: rowNum,
					status: "created",
					studentId: student.id,
				});
			} catch (err) {
				results.push({
					row: rowNum,
					status: "failed",
					reason:
						err instanceof Error
							? err.message
							: "Unknown error",
				});
			}
		}

		return {
			total: results.length,
			created: results.filter(
				(result) => result.status === "created",
			).length,
			failed: results.filter(
				(result) => result.status === "failed",
			).length,
			results,
		};
	}
}