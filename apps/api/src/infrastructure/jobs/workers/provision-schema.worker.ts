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
import { isValidSchemaName, schemaNameFor } from "../../../shared/utils/schema-name";
import { loadLedgerAccountTemplates, seedFinanceBooks } from "../../../modules/ledger/services/ledger-seed";


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

// incomeCode is the chart-of-accounts code (see ledger.templates) where money for this fee is earned.
const defaultFeeTypes = [
	{ code: "SCHOOL_FEES", name: "School Fees", description: "Termly tuition fee", incomeCode: "4000" },
	{ code: "DEVELOPMENT_LEVY", name: "Development Levy", description: "Annual infrastructure and development contribution", incomeCode: "4900" },
	{ code: "PTA_LEVY", name: "PTA Levy", description: "Parent-Teacher Association dues", incomeCode: "4900" },
	{ code: "LESSON_FEE", name: "Lesson/Tutorial Fee", description: "Extra-curricular lesson or tutorial fee", incomeCode: "4900" },
	{ code: "UNIFORM_FEE", name: "Uniform Fee", description: "School uniform cost", incomeCode: "4040" },
	{ code: "EXAM_FEE", name: "Exam Fee", description: "Termly examination fee", incomeCode: "4020" },
];

/*
| The schema name to use for a school: the stored one when it is valid. A school saved with an invalid name (older records
| used "school_<subdomain>" with hyphens) that is NOT built yet gets the canonical name written back first. One that is
| already built under an invalid name must be renamed with `npm run repair:schema-names`; it is never guessed at here.
*/
async function settledSchemaName(schoolId: string): Promise<string> {
	const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { subdomain: true, schemaName: true, schemaProvisionedAt: true } });
	if (!school) throw new Error(`School ${schoolId} not found`);
	if (isValidSchemaName(school.schemaName)) return school.schemaName;

	if (school.schemaProvisionedAt) {
		throw new Error(`School ${schoolId} is provisioned under an invalid schema name "${school.schemaName}". Run: npm run repair:schema-names`);
	}
	const canonical = schemaNameFor(school.subdomain);
	await prisma.school.update({ where: { id: schoolId }, data: { schemaName: canonical } });
	console.log(`🔧 Repaired schema name for school ${schoolId}: "${school.schemaName ?? "(none)"}" -> ${canonical}`);
	return canonical;
}

// Used only for the first-admin step (it reads the public database and the school's own schema)
const membershipService = new MembershipService({
	prismaClient: prisma,
	urlService: new UrlService(),
});

export const provisionSchemaWorker = new Worker<ProvisionSchemaJobData>(
	"provision-schema",

	async (job: Job<ProvisionSchemaJobData>) => {
		const { schoolId, schoolName } = job.data;

		// The school's stored schema name is the only name used. (Older records may hold one with hyphens: it is repaired here.)
		const schemaName = await settledSchemaName(schoolId);

		const pool = new Pool({ connectionString: env.DATABASE_URL });
		const client = await pool.connect();
		const lockKey = `provision:${schoolId}`;
		let locked = false;

		try {
			// Only one run per school at a time: a duplicate or retried job waits here, then sees the finished work and stops.
			await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
			locked = true;

			const current = await prisma.school.findUnique({ where: { id: schoolId }, select: { schemaProvisionedAt: true } });
			if (current?.schemaProvisionedAt) {
				console.log(`⏭️  Skipping provisioning — ${schemaName} already provisioned`);
				return { schemaName, status: "already_provisioned" };
			}
			console.log(`🏗️  Provisioning schema: ${schemaName} for ${schoolName}`);

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

					const tenantMigrationsDir = join(__dirname, "..", "..", "..", "..", "prisma", "tenant-migrations")   // apps/api/prisma, from src/ or dist/;
					const migrations = readdirSync(tenantMigrationsDir, { withFileTypes: true })
						.filter(entry => entry.isDirectory())
						.map(entry => entry.name)
						.sort();

					// Remember which migrations built this schema, so "migrate:apply-to-existing-schools" only runs LATER ones.
					await client.query(`CREATE TABLE IF NOT EXISTS "_tenant_migrations_applied" (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())`);
					for (const migration of migrations) {
						const sqlPath = join(tenantMigrationsDir, migration, "migration.sql");
						await client.query(readFileSync(sqlPath, "utf8"));
						await client.query(`INSERT INTO "_tenant_migrations_applied" (name) VALUES ($1) ON CONFLICT DO NOTHING`, [migration]);
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

					// Fee types need their income accounts, so they are seeded after the chart of accounts
					for (const [index, feeType] of defaultFeeTypes.entries()) {
						const inserted = await client.query(
							`INSERT INTO "FeeType" (id, code, name, description, "incomeAccountId", "sortOrder", "createdAt", "updatedAt")
							 SELECT gen_random_uuid(), $1, $2, $3, a.id, $5, now(), now()
							 FROM "LedgerAccount" a WHERE a.code = $4`,
							[feeType.code, feeType.name, feeType.description, feeType.incomeCode, index],
						);
						if (inserted.rowCount !== 1) {
							throw new Error(`Fee type ${feeType.code} needs income account ${feeType.incomeCode}, which is not in the chart of accounts`);
						}
					}
					console.log(`✅ Default fee types seeded: ${schemaName}`);

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
			// The lock is held through the end, so two runs can never both create the first admin.
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
		} finally {
			await client.query("SET search_path TO public").catch(() => undefined);
			if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined);
			client.release();
			await pool.end();
		}
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
