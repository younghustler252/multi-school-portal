import * as Sentry from "@sentry/node";
import { Worker, Job } from "bullmq";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { redisConnection } from "../connection";
import { ProvisionSchemaJobData } from "../queues/provision-schema.queue";
import { prisma } from "../../database/prisma/prisma.client";
import { TenantContext } from "../../database/prisma/tenant.context";
import { env } from "../../../config/env";
import { MembershipService } from "../../../modules/auth/services/membership.service";
import { UrlService } from "../../../shared/services/url.service";
import { loadLedgerAccountTemplates, seedFinanceBooks } from "../../../modules/ledger/ledger.provisioning";


function getDefaultClasses(category?: string | null): Array<{ name: string; level: string }> {
	if (category === "primary" || category === "primary_secondary") {
		return [
			{ name: "KG 1", level: "Kindergarten" },
			{ name: "KG 2", level: "Kindergarten" },
			{ name: "Primary 1", level: "Primary" },
			{ name: "Primary 2", level: "Primary" },
			{ name: "Primary 3", level: "Primary" },
			{ name: "Primary 4", level: "Primary" },
			{ name: "Primary 5", level: "Primary" },
			{ name: "Primary 6", level: "Primary" },
		];
	}

	const secondary = [
		{ name: "JSS 1", level: "Junior Secondary" },
		{ name: "JSS 2", level: "Junior Secondary" },
		{ name: "JSS 3", level: "Junior Secondary" },
		{ name: "SS 1", level: "Senior Secondary" },
		{ name: "SS 2", level: "Senior Secondary" },
		{ name: "SS 3", level: "Senior Secondary" },
	];

	return secondary;
}

function getDefaultSubjects(category?: string | null): Array<{ name: string; code: string }> {
	const coreSubjects = [
		{ name: "Mathematics", code: "MTH" },
		{ name: "English Language", code: "ENG" },
		{ name: "Basic Science", code: "BSC" },
		{ name: "Social Studies", code: "SST" },
		{ name: "Civic Education", code: "CIV" },
		{ name: "Computer Science", code: "CMP" },
		{ name: "Physical Education", code: "PHE" },
		{ name: "Fine Arts", code: "ART" },
		{ name: "Music", code: "MUS" },
	];

	const primaryOnly = [
		{ name: "Quantitative Reasoning", code: "QNR" },
		{ name: "Verbal Reasoning", code: "VBR" },
		{ name: "Phonics", code: "PHN" },
		{ name: "National Values", code: "NVE" },
	];

	const secondaryOnly = [
		{ name: "Physics", code: "PHY" },
		{ name: "Chemistry", code: "CHM" },
		{ name: "Biology", code: "BIO" },
		{ name: "Economics", code: "ECO" },
		{ name: "Government", code: "GOV" },
		{ name: "Literature", code: "LIT" },
		{ name: "Geography", code: "GEO" },
		{ name: "Agricultural Sc.", code: "AGR" },
		{ name: "Further Maths", code: "FMT" },
		{ name: "French", code: "FRN" },
		{ name: "Yoruba", code: "YRB" },
		{ name: "Igbo", code: "IGB" },
		{ name: "Hausa", code: "HAU" },
	];

	if (category === "primary") {
		return [...coreSubjects, ...primaryOnly];
	}

	if (category === "primary_secondary") {
		return [...coreSubjects, ...primaryOnly, ...secondaryOnly];
	}

	return [...coreSubjects, ...secondaryOnly];
}

const defaultFeeTypes = [
	{ name: "School Fees", description: "Termly tuition fee" },
	{ name: "Development Levy", description: "Annual infrastructure and development contribution" },
	{ name: "PTA Levy", description: "Parent-Teacher Association dues" },
	{ name: "Lesson/Tutorial Fee", description: "Extra-curricular lesson or tutorial fee" },
	{ name: "Uniform Fee", description: "School uniform cost" },
	{ name: "Exam Fee", description: "Termly examination fee" },
];

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

// Used only for the first-admin step (it reads the public database and the school's own schema)
const membershipService = new MembershipService({
	prismaClient: prisma,
	urlService: new UrlService(),
});

export const provisionSchemaWorker = new Worker<ProvisionSchemaJobData>(
	"provision-schema",

	async (job: Job<ProvisionSchemaJobData>) => {
		const { schoolId, subdomain, schoolName } = job.data;
		const schemaName = `school_${subdomain}`;

		if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
			throw new Error(`Invalid schema name: ${schemaName}`);
		}

		const existingSchool = await prisma.school.findUnique({
			where: { id: schoolId },
			select: { schemaProvisionedAt: true },
		});

		if (existingSchool?.schemaProvisionedAt) {
			console.log(`⏭️  Skipping provisioning — ${schemaName} already provisioned`);
			return { schemaName, status: "already_provisioned" };
		}

		console.log(`🏗️  Provisioning schema: ${schemaName} for ${schoolName}`);

		const pool = new Pool({ connectionString: env.DATABASE_URL });
		const client = await pool.connect();

		try {
			// ── 1. Build the school's tables and starting data (all or nothing) ──
			// If the schema already exists (an earlier run built it and only a later step failed),
			// it is NEVER dropped or rebuilt: we resume at the first-admin step.
			const exists = await client.query(
				"SELECT 1 FROM information_schema.schemata WHERE schema_name = $1",
				[schemaName],
			);

			if (exists.rowCount === 0) {
				try {
					await client.query("BEGIN");

					await client.query(`CREATE SCHEMA "${schemaName}"`);
					await client.query(`SET search_path TO "${schemaName}"`);

					const tenantMigrationsDir = join(process.cwd(), "prisma", "tenant-migrations");
					const migrations = readdirSync(tenantMigrationsDir, { withFileTypes: true })
						.filter(entry => entry.isDirectory())
						.map(entry => entry.name)
						.sort();

					for (const migration of migrations) {
						const sqlPath = join(tenantMigrationsDir, migration, "migration.sql");
						await client.query(readFileSync(sqlPath, "utf8"));
					}

					console.log(`✅ Tables created: ${schemaName}`);

					const gradingDefaults = [
						{ minScore: 75, maxScore: 100, grade: "A1", remark: "Excellent" },
						{ minScore: 70, maxScore: 74, grade: "B2", remark: "Very Good" },
						{ minScore: 65, maxScore: 69, grade: "B3", remark: "Good" },
						{ minScore: 60, maxScore: 64, grade: "C4", remark: "Credit" },
						{ minScore: 55, maxScore: 59, grade: "C5", remark: "Credit" },
						{ minScore: 50, maxScore: 54, grade: "C6", remark: "Credit" },
						{ minScore: 45, maxScore: 49, grade: "D7", remark: "Pass" },
						{ minScore: 40, maxScore: 44, grade: "E8", remark: "Pass" },
						{ minScore: 0, maxScore: 39, grade: "F9", remark: "Fail" },
					];

					for (const g of gradingDefaults) {
						await client.query(
							`INSERT INTO "GradingConfig" (id, "minScore", "maxScore", grade, remark, "isDefault", "createdAt", "updatedAt")
							 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now(), now())`,
							[g.minScore, g.maxScore, g.grade, g.remark],
						);
					}

					console.log(`✅ Grading config seeded: ${schemaName}`);

					for (const feeType of defaultFeeTypes) {
						await client.query(
							`INSERT INTO "FeeType" (id, name, description, "createdAt", "updatedAt")
							 VALUES (gen_random_uuid(), $1, $2, now(), now())`,
							[feeType.name, feeType.description],
						);
					}

					console.log(`✅ Default fee types seeded: ${schemaName}`);

					// Every school has one main branch from day one (the app hides branch pickers while there is only one)
					await client.query(
						`INSERT INTO "Branch" (id, name, code, "isMain", "isActive", "createdAt", "updatedAt")
						 VALUES (gen_random_uuid(), 'Main Campus', 'MAIN', true, true, now(), now())`,
					);
					console.log(`✅ Main branch created: ${schemaName}`);

					// Books: chart of accounts (copied from the platform templates) and this fiscal year's months
					const ledgerTemplates = await loadLedgerAccountTemplates(prisma as any);
					const books = await seedFinanceBooks(client, ledgerTemplates);
					console.log(`✅ Finance books seeded (${books.accounts} accounts, ${books.periods} periods): ${schemaName}`);

					// ── School roles: copied from the platform's role templates ──
					// Templates are data the platform team edits; each school gets its own copy
					// and remembers which template (and version) it came from.
					const templates = await prisma.roleTemplate.findMany({
						where: { isActive: true, autoProvision: true },
						include: { permissions: true },
					});

					if (!templates.some(t => t.key === "school_admin")) {
						throw new Error(
							"The 'school_admin' role template is missing. Seed the role templates before provisioning schools.",
						);
					}

					for (const t of templates) {
						const roleId = randomUUID();
						await client.query(
							`INSERT INTO "SchoolRole"
							   (id, name, description, kind, persona, "grantsAll", "sourceTemplateKey", "sourceTemplateVersion", "isCustomized", "createdAt", "updatedAt")
							 VALUES ($1, $2, $3, $4::"RoleKind", $5::"Persona", $6, $7, $8, false, now(), now())`,
							[
								roleId, t.name, t.description,
								t.isLocked ? "SYSTEM_LOCKED" : "SYSTEM_EDITABLE",
								t.persona, t.grantsAll, t.key, t.version,
							],
						);
						for (const p of t.permissions) {
							await client.query(
								`INSERT INTO "SchoolRolePermission" ("roleId", "permissionKey", scope)
								 VALUES ($1, $2, $3::"PermissionScope")`,
								[roleId, p.permissionKey, p.scope],
							);
						}
					}

					console.log(`✅ ${templates.length} roles created: ${schemaName}`);

					// const school = await prisma.school.findUnique({
					// 	where: { id: schoolId },
					// 	select: { schoolCategory: true },
					// });

					// for (const cls of getDefaultClasses(school?.schoolCategory)) {
					// 	await client.query(
					// 		`INSERT INTO "Class" (id, name, level, "createdAt", "updatedAt")
					// 		 VALUES (gen_random_uuid(), $1, $2, now(), now())`,
					// 		[cls.name, cls.level],
					// 	);
					// }

					// for (const subject of getDefaultSubjects(school?.schoolCategory)) {
					// 	await client.query(
					// 		`INSERT INTO "Subject" (id, name, code, "createdAt", "updatedAt")
					// 		 VALUES (gen_random_uuid(), $1, $2, now(), now())`,
					// 		[subject.name, subject.code],
					// 	);
					// }

					// console.log(`✅ Classes + subjects seeded: ${schemaName}`);

					await client.query("COMMIT");
				} catch (err) {
					await client.query("ROLLBACK");   // undoes the new schema too: nothing half-built is left behind
					throw err;
				}
			} else {
				console.log(`↩️  ${schemaName} already exists, resuming at the first-admin step`);
			}
		} finally {
			await client.query("SET search_path TO public").catch(() => undefined);
			client.release();
			await pool.end();
		}

		// ── 2. Give the person who registered real access (needs the committed schema) ──
		await new Promise<void>((resolve, reject) =>
			TenantContext.run({ tenantSchema: schemaName, schoolId }, () => {
				membershipService.provisionFirstAdmin(schoolId).then(() => resolve(), reject);
			}),
		);
		console.log(`✅ School admin access created: ${schemaName}`);

		// ── 3. Only now is the school marked as provisioned ──
		await prisma.school.update({
			where: { id: schoolId },
			data: { schemaProvisionedAt: new Date() },
		});

		console.log(`🎉 Provisioning complete: ${schemaName}`);
		return { schemaName, status: "completed" };
	},

	{ connection: redisConnection, concurrency: 2 },
);

provisionSchemaWorker.on("completed", (job) => {
	console.log(`✅ Provision job ${job.id} completed`);
});

provisionSchemaWorker.on("failed", (job, err) => {
    console.error(`❌ Provision job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id, jobName: job?.name } });
});

provisionSchemaWorker.on("error", (err) => {
	console.error("❌ Worker error:", err.message);
});
